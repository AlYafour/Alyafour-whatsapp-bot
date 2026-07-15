import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';
import { translateApiError } from '../utils/apiError';
import Dialog from './ui/Dialog';
import Button from './ui/Button';

function substitute(text, values) {
  if (!text) return text;
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n) => {
    const v = values[Number(n) - 1];
    return v && v.trim() ? v : `[${n}]`;
  });
}

function emptyArray(len) {
  return Array.from({ length: len }, () => '');
}

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function NewConversationModal({ open, onClose, onCreated, initialPhone = '', initialName = '' }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [templates, setTemplates] = useState([]);
  const [wabaId, setWabaId] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [languageFilterOnly, setLanguageFilterOnly] = useState('');

  const [selectedName, setSelectedName] = useState('');
  const [selectedLanguageCode, setSelectedLanguageCode] = useState('');

  const [headerValues, setHeaderValues] = useState([]);
  const [headerMedia, setHeaderMedia] = useState('');
  const [bodyValues, setBodyValues] = useState([]);
  const [buttonValues, setButtonValues] = useState({});

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(newIdempotencyKey);

  async function loadTemplates(refresh) {
    setTemplatesLoading(true);
    try {
      const data = await api.listTemplates(refresh);
      setTemplates(data.templates || []);
      setWabaId(data.wabaId || null);
      setTemplatesError('');
    } catch (err) {
      setTemplatesError(translateApiError(err, t));
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadTemplates(false);
      // Prefill when opened from an expired conversation ("reopen with template").
      if (initialPhone) setPhone(initialPhone);
      if (initialName) setCustomerName(initialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      if (search && !tpl.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && tpl.category !== categoryFilter) return false;
      if (languageFilterOnly && !tpl.languages.some((l) => l.languageCode === languageFilterOnly)) return false;
      return true;
    });
  }, [templates, search, categoryFilter, languageFilterOnly]);

  const categories = useMemo(() => Array.from(new Set(templates.map((tpl) => tpl.category))).filter(Boolean), [templates]);
  const allLanguageCodes = useMemo(
    () => Array.from(new Set(templates.flatMap((tpl) => tpl.languages.map((l) => l.languageCode)))),
    [templates]
  );

  const selectedTemplate = templates.find((tpl) => tpl.name === selectedName) || null;
  const selectedLanguage = selectedTemplate?.languages.find((l) => l.languageCode === selectedLanguageCode) || null;

  const headerComp = selectedLanguage?.components.find((c) => c.type === 'HEADER') || null;
  const bodyComp = selectedLanguage?.components.find((c) => c.type === 'BODY') || null;
  const footerComp = selectedLanguage?.components.find((c) => c.type === 'FOOTER') || null;
  const buttonsComp = selectedLanguage?.components.find((c) => c.type === 'BUTTONS') || null;

  function selectTemplate(name) {
    setSelectedName(name);
    const tpl = templates.find((t) => t.name === name);
    const firstLang = tpl?.languages[0]?.languageCode || '';
    applyLanguage(tpl, firstLang);
  }

  function applyLanguage(tpl, languageCode) {
    setSelectedLanguageCode(languageCode);
    const lang = tpl?.languages.find((l) => l.languageCode === languageCode);
    const h = lang?.components.find((c) => c.type === 'HEADER');
    const b = lang?.components.find((c) => c.type === 'BODY');
    setHeaderValues(emptyArray(h?.variablesCount || 0));
    setHeaderMedia('');
    setBodyValues(emptyArray(b?.variablesCount || 0));
    setButtonValues({});
  }

  function buildComponents() {
    const components = [];

    if (headerComp?.format === 'TEXT' && headerComp.variablesCount > 0) {
      components.push({ type: 'header', parameters: headerValues.map((v) => ({ type: 'text', text: v })) });
    } else if (headerComp?.requiresMedia && headerMedia.trim()) {
      const mediaType = headerComp.format.toLowerCase();
      components.push({ type: 'header', parameters: [{ type: mediaType, [mediaType]: { link: headerMedia.trim() } }] });
    }

    if (bodyComp?.variablesCount > 0) {
      components.push({ type: 'body', parameters: bodyValues.map((v) => ({ type: 'text', text: v })) });
    }

    if (buttonsComp) {
      buttonsComp.buttons.forEach((btn) => {
        if (btn.variablesCount > 0 && buttonValues[btn.index]?.trim()) {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: String(btn.index),
            parameters: [{ type: 'text', text: buttonValues[btn.index].trim() }],
          });
        }
      });
    }

    return components;
  }

  const previewText = useMemo(() => {
    if (!selectedLanguage) return '';
    const parts = [];
    if (headerComp?.format === 'TEXT') parts.push(substitute(headerComp.text, headerValues));
    else if (headerComp?.requiresMedia) parts.push(`[${headerComp.format}]`);
    parts.push(substitute(bodyComp?.text, bodyValues));
    if (footerComp?.text) parts.push(footerComp.text);
    return parts.filter(Boolean).join('\n\n');
  }, [selectedLanguage, headerComp, bodyComp, footerComp, headerValues, bodyValues]);

  function validateForm() {
    if (!phone.trim()) return t('newConversation.validation.phoneRequired');
    if (!selectedTemplate) return t('newConversation.validation.templateRequired');
    if (!selectedLanguageCode) return t('newConversation.validation.languageRequired');
    if (headerComp?.format === 'TEXT' && headerValues.some((v) => !v.trim())) return t('newConversation.validation.headerRequired');
    if (headerComp?.requiresMedia && !headerMedia.trim()) return t('newConversation.validation.headerMediaRequired');
    if (bodyValues.some((v) => !v.trim())) return t('newConversation.validation.bodyRequired');
    return '';
  }

  async function handleSend(e) {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSending(true);
    setError('');
    try {
      const payload = {
        phone: phone.trim(),
        customerName: customerName.trim() || undefined,
        templateName: selectedName,
        languageCode: selectedLanguageCode,
        components: buildComponents(),
      };
      const data = await api.startConversation(payload, idempotencyKey);
      onCreated(data.conversation);
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title={t('newConversation.title')} wide>
      <form onSubmit={handleSend} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('newConversation.phone')}</span>
            <input dir="ltr" placeholder={t('newConversation.phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('newConversation.customerName')}</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
          </label>
        </div>

        <div className="rounded-xl border border-border p-2.5">
          <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
            <input
              type="search"
              placeholder={t('newConversation.searchTemplates')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="col-span-2 rounded-lg border border-border px-2.5 py-1.5 text-sm sm:col-span-1"
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-sm">
              <option value="">{t('newConversation.allCategories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(`newConversation.category.${c}`, c)}
                </option>
              ))}
            </select>
            <select value={languageFilterOnly} onChange={(e) => setLanguageFilterOnly(e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-sm">
              <option value="">{t('newConversation.allLanguages')}</option>
              {allLanguageCodes.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <Button type="button" variant="ghost" size="sm" onClick={() => loadTemplates(true)}>
              <RefreshCw size={14} />
            </Button>
          </div>

          {templatesLoading && <div className="py-4 text-center text-sm text-text-muted">{t('newConversation.loadingTemplates')}</div>}
          {!templatesLoading && templatesError && <div className="py-4 text-center text-sm text-danger">{templatesError}</div>}
          {!templatesLoading && !templatesError && filteredTemplates.length === 0 && (
            <div className="py-4 text-center text-sm text-text-muted">{t('newConversation.noTemplates')}</div>
          )}

          {!templatesLoading && wabaId && (
            <div className="pb-1 text-center text-[10px] text-text-muted" dir="ltr">
              {t('newConversation.wabaSource')}: {wabaId} · {templates.length} {t('newConversation.templatesCount')}
            </div>
          )}

          {!templatesLoading && !templatesError && filteredTemplates.length > 0 && (
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {filteredTemplates.map((tpl) => {
                const sendable = tpl.approved !== false;
                const rawStatus = tpl.languages?.find((l) => l.status && l.status !== 'APPROVED')?.status;
                return (
                  <button
                    type="button"
                    key={tpl.name}
                    disabled={!sendable}
                    onClick={() => selectTemplate(tpl.name)}
                    title={!sendable && rawStatus ? rawStatus : undefined}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-start text-sm ${
                      !sendable
                        ? 'cursor-not-allowed border-border bg-bg opacity-55'
                        : selectedName === tpl.name
                          ? 'border-brand bg-brand-soft'
                          : 'border-border bg-bg hover:bg-surface-2'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold">{tpl.name}</span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                      {t(`newConversation.category.${tpl.category}`, tpl.category)}
                    </span>
                    {sendable ? (
                      <span className="shrink-0 rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[11px] text-brand-strong">
                        {t('newConversation.approved')}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-pending/30 bg-pending-soft px-2 py-0.5 text-[11px] text-pending">
                        {t(`newConversation.status.${rawStatus}`, rawStatus || '—')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedTemplate && (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
              <span>{t('newConversation.templateLanguage')}</span>
              <select value={selectedLanguageCode} onChange={(e) => applyLanguage(selectedTemplate, e.target.value)} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-normal text-text">
                {selectedTemplate.languages.map((l) => (
                  <option key={l.languageCode} value={l.languageCode}>
                    {l.languageCode}
                  </option>
                ))}
              </select>
            </label>

            {headerComp?.format === 'TEXT' && headerComp.variablesCount > 0 && (
              <div className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                <span>{t('newConversation.headerVariables')}</span>
                {headerValues.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    onChange={(e) => setHeaderValues((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-normal text-text"
                  />
                ))}
              </div>
            )}

            {headerComp?.requiresMedia && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
                <span>{t('newConversation.headerMediaUrl', { type: headerComp.format })}</span>
                <input dir="ltr" placeholder="https://…" value={headerMedia} onChange={(e) => setHeaderMedia(e.target.value)} className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-normal text-text" />
              </label>
            )}

            {bodyValues.length > 0 && (
              <div className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                <span>{t('newConversation.bodyVariables')}</span>
                {bodyValues.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    onChange={(e) => setBodyValues((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-normal text-text"
                  />
                ))}
              </div>
            )}

            {buttonsComp?.buttons.some((b) => b.variablesCount > 0) && (
              <div className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                <span>{t('newConversation.buttonVariables')}</span>
                {buttonsComp.buttons
                  .filter((b) => b.variablesCount > 0)
                  .map((b) => (
                    <input
                      key={b.index}
                      dir="ltr"
                      placeholder={b.text || ''}
                      value={buttonValues[b.index] || ''}
                      onChange={(e) => setButtonValues((prev) => ({ ...prev, [b.index]: e.target.value }))}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-normal text-text"
                    />
                  ))}
              </div>
            )}

            <div>
              <div className="mb-1 text-xs font-bold text-text-muted">{t('newConversation.preview')}</div>
              <div className="bubble bubble--agent px-3 py-2">
                <div className="whitespace-pre-wrap text-sm">{previewText}</div>
              </div>
            </div>
          </div>
        )}

        {error && <div className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('newConversation.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={sending || !selectedTemplate}>
            {sending ? t('newConversation.sending') : t('newConversation.send')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
