const { graphGet } = require('./metaGraph');

const CACHE_TTL_MS = 60 * 1000;
let cache = { at: 0, data: null };

function extractPlaceholderCount(text) {
  if (!text) return 0;
  const seen = new Set();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text))) seen.add(m[1]);
  return seen.size;
}

const MEDIA_HEADER_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT'];

function normalizeComponent(component) {
  const type = component.type;

  if (type === 'HEADER') {
    const format = component.format || 'TEXT';
    return {
      type: 'HEADER',
      format,
      text: component.text || null,
      variablesCount: format === 'TEXT' ? extractPlaceholderCount(component.text) : 0,
      requiresMedia: MEDIA_HEADER_FORMATS.includes(format),
    };
  }

  if (type === 'BODY') {
    return { type: 'BODY', text: component.text || '', variablesCount: extractPlaceholderCount(component.text) };
  }

  if (type === 'FOOTER') {
    return { type: 'FOOTER', text: component.text || null };
  }

  if (type === 'BUTTONS') {
    return {
      type: 'BUTTONS',
      buttons: (component.buttons || []).map((b, index) => ({
        index,
        type: b.type,
        text: b.text || null,
        url: b.url || null,
        phoneNumber: b.phone_number || null,
        variablesCount: b.type === 'URL' ? extractPlaceholderCount(b.url) : 0,
      })),
    };
  }

  return { type, raw: component };
}

async function fetchAllTemplates() {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!wabaId) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not set');

  let all = [];
  let after;

  for (let page = 0; page < 10; page++) {
    const params = { fields: 'name,category,language,status,components', limit: '100' };
    if (after) params.after = after;

    const { status, body } = await graphGet(`/${wabaId}/message_templates`, params);
    if (status >= 400) {
      const err = new Error(body?.error?.message || 'Failed to fetch templates from Meta');
      err.metaError = body?.error;
      throw err;
    }

    all = all.concat(body.data || []);
    after = body.paging?.next ? body.paging?.cursors?.after : null;
    if (!after) break;
  }

  return all;
}

// Returns ALL templates grouped by name — each language variant carries its
// real Meta status so the dashboard can show non-approved ones (in review,
// rejected, paused, ...) greyed out instead of silently hiding them. Only
// APPROVED variants are sendable (enforced in findTemplateLanguage).
async function listApprovedTemplates({ forceRefresh } = {}) {
  if (!forceRefresh && cache.data && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const raw = await fetchAllTemplates();

  const byName = new Map();
  for (const t of raw) {
    if (['DELETED', 'PENDING_DELETION'].includes(t.status)) continue;
    if (!byName.has(t.name)) byName.set(t.name, { name: t.name, category: t.category, languages: [] });
    byName.get(t.name).languages.push({
      languageCode: t.language,
      status: t.status,
      components: (t.components || []).map(normalizeComponent),
    });
  }

  const result = Array.from(byName.values()).map((tpl) => ({
    ...tpl,
    approved: tpl.languages.some((l) => l.status === 'APPROVED'),
  }));
  cache = { at: Date.now(), data: result };
  return result;
}

function findTemplateLanguage(templates, name, languageCode) {
  const template = templates.find((t) => t.name === name);
  if (!template) return { template: null, language: null };
  const language = template.languages.find((l) => l.languageCode === languageCode);
  // Only an APPROVED variant may actually be sent.
  if (language && language.status && language.status !== 'APPROVED') {
    return { template, language: null };
  }
  return { template, language: language || null };
}

function paramsForType(components, type) {
  const comp = (components || []).find((c) => String(c.type).toLowerCase() === type);
  return comp?.parameters || [];
}

function substitute(text, params) {
  if (!text) return text;
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n) => {
    const p = params[Number(n) - 1];
    if (!p) return match;
    return p.text ?? p.currency?.fallback_value ?? p.date_time?.fallback_value ?? match;
  });
}

// Checks the components the caller wants to send against what the approved
// template actually requires. Returns { valid, missing[] } — missing lists
// human-readable (Arabic) descriptions of what's absent, never internals.
function validateComponents(languageDef, providedComponents) {
  const missing = [];
  const bodyParams = paramsForType(providedComponents, 'body');
  const headerParams = paramsForType(providedComponents, 'header');

  for (const comp of languageDef.components) {
    if (comp.type === 'BODY' && comp.variablesCount > bodyParams.length) {
      missing.push(`نص الرسالة يحتاج ${comp.variablesCount} متغير(ات) ولم يتم توفير سوى ${bodyParams.length}`);
    }
    if (comp.type === 'HEADER') {
      if (comp.format === 'TEXT' && comp.variablesCount > headerParams.length) {
        missing.push(`العنوان يحتاج ${comp.variablesCount} متغير(ات)`);
      }
      if (comp.requiresMedia && headerParams.length === 0) {
        missing.push(`العنوان يتطلب إرفاق ${comp.format === 'IMAGE' ? 'صورة' : comp.format === 'VIDEO' ? 'فيديو' : 'مستند'}`);
      }
    }
    if (comp.type === 'BUTTONS') {
      for (const btn of comp.buttons) {
        if (btn.variablesCount > 0) {
          const btnComp = (providedComponents || []).find(
            (c) => String(c.type).toLowerCase() === 'button' && Number(c.index) === btn.index
          );
          if (!btnComp?.parameters?.length) {
            missing.push(`الزر رقم ${btn.index + 1} يحتاج قيمة`);
          }
        }
      }
    }
  }

  return { valid: missing.length === 0, missing };
}

function renderPreview(languageDef, providedComponents) {
  const header = languageDef.components.find((c) => c.type === 'HEADER');
  const body = languageDef.components.find((c) => c.type === 'BODY');
  const footer = languageDef.components.find((c) => c.type === 'FOOTER');

  const headerText =
    header?.format === 'TEXT' ? substitute(header.text, paramsForType(providedComponents, 'header')) : null;
  const bodyText = substitute(body?.text, paramsForType(providedComponents, 'body'));
  const footerText = footer?.text || null;

  return [headerText, bodyText, footerText].filter(Boolean).join('\n\n');
}

module.exports = {
  listApprovedTemplates,
  findTemplateLanguage,
  validateComponents,
  renderPreview,
  extractPlaceholderCount,
};
