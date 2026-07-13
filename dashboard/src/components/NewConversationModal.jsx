import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

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

const CATEGORY_LABEL = { MARKETING: 'تسويقي', UTILITY: 'خدمي', AUTHENTICATION: 'توثيق' };

export default function NewConversationModal({ onClose, onCreated }) {
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [templates, setTemplates] = useState([]);
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
      setTemplatesError('');
    } catch (err) {
      setTemplatesError(err.message || 'تعذر تحميل القوالب المعتمدة من Meta');
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates(false);
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (languageFilterOnly && !t.languages.some((l) => l.languageCode === languageFilterOnly)) return false;
      return true;
    });
  }, [templates, search, categoryFilter, languageFilterOnly]);

  const categories = useMemo(() => Array.from(new Set(templates.map((t) => t.category))).filter(Boolean), [templates]);
  const allLanguageCodes = useMemo(
    () => Array.from(new Set(templates.flatMap((t) => t.languages.map((l) => l.languageCode)))),
    [templates]
  );

  const selectedTemplate = templates.find((t) => t.name === selectedName) || null;
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

  function handleLanguageChange(languageCode) {
    applyLanguage(selectedTemplate, languageCode);
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
    else if (headerComp?.requiresMedia) parts.push(`[${headerComp.format === 'IMAGE' ? 'صورة' : headerComp.format === 'VIDEO' ? 'فيديو' : 'مستند'} مرفق]`);
    parts.push(substitute(bodyComp?.text, bodyValues));
    if (footerComp?.text) parts.push(footerComp.text);
    return parts.filter(Boolean).join('\n\n');
  }, [selectedLanguage, headerComp, bodyComp, footerComp, headerValues, bodyValues]);

  function validateForm() {
    if (!phone.trim()) return 'أدخل رقم الهاتف';
    if (!selectedTemplate) return 'اختر القالب';
    if (!selectedLanguageCode) return 'اختر لغة القالب';
    if (headerComp?.format === 'TEXT' && headerValues.some((v) => !v.trim())) return 'أكمل متغيرات العنوان';
    if (headerComp?.requiresMedia && !headerMedia.trim()) return 'أدخل رابط الوسائط للعنوان';
    if (bodyValues.some((v) => !v.trim())) return 'أكمل جميع متغيرات نص الرسالة';
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
      setError(err.message || 'تعذر إرسال القالب');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-card__header">
          <h3>محادثة جديدة</h3>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            إغلاق ✕
          </button>
        </div>

        <form className="new-conv-form" onSubmit={handleSend}>
          <div className="new-conv-form__grid">
            <label className="field">
              <span>رقم الهاتف (بالصيغة الدولية)</span>
              <input dir="ltr" placeholder="971501234567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <label className="field">
              <span>اسم العميل (اختياري)</span>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </label>
          </div>

          <div className="template-picker">
            <div className="template-picker__filters">
              <input
                type="search"
                placeholder="ابحث عن قالب…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">كل الفئات</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c] || c}
                  </option>
                ))}
              </select>
              <select value={languageFilterOnly} onChange={(e) => setLanguageFilterOnly(e.target.value)}>
                <option value="">كل اللغات</option>
                {allLanguageCodes.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => loadTemplates(true)}>
                تحديث ⟳
              </button>
            </div>

            {templatesLoading && <div className="state-message">جارِ تحميل القوالب المعتمدة…</div>}
            {!templatesLoading && templatesError && <div className="state-message state-message--error">{templatesError}</div>}
            {!templatesLoading && !templatesError && filteredTemplates.length === 0 && (
              <div className="state-message">لا توجد قوالب معتمدة مطابقة</div>
            )}

            {!templatesLoading && !templatesError && filteredTemplates.length > 0 && (
              <div className="template-list">
                {filteredTemplates.map((t) => (
                  <button
                    type="button"
                    key={t.name}
                    className={`template-list__item ${selectedName === t.name ? 'template-list__item--active' : ''}`}
                    onClick={() => selectTemplate(t.name)}
                  >
                    <span className="template-list__name">{t.name}</span>
                    <span className="tag">{CATEGORY_LABEL[t.category] || t.category}</span>
                    <span className="tag tag--window-open">معتمد</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTemplate && (
            <div className="template-editor">
              <label className="field">
                <span>لغة القالب</span>
                <select value={selectedLanguageCode} onChange={(e) => handleLanguageChange(e.target.value)}>
                  {selectedTemplate.languages.map((l) => (
                    <option key={l.languageCode} value={l.languageCode}>
                      {l.languageCode}
                    </option>
                  ))}
                </select>
              </label>

              {headerComp?.format === 'TEXT' && headerComp.variablesCount > 0 && (
                <div className="field-group">
                  <span>متغيرات العنوان</span>
                  {headerValues.map((v, i) => (
                    <input
                      key={i}
                      placeholder={`متغير العنوان ${i + 1}`}
                      value={v}
                      onChange={(e) => setHeaderValues((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    />
                  ))}
                </div>
              )}

              {headerComp?.requiresMedia && (
                <label className="field">
                  <span>رابط {headerComp.format === 'IMAGE' ? 'الصورة' : headerComp.format === 'VIDEO' ? 'الفيديو' : 'المستند'} (URL)</span>
                  <input dir="ltr" placeholder="https://…" value={headerMedia} onChange={(e) => setHeaderMedia(e.target.value)} />
                </label>
              )}

              {bodyValues.length > 0 && (
                <div className="field-group">
                  <span>متغيرات نص الرسالة</span>
                  {bodyValues.map((v, i) => (
                    <input
                      key={i}
                      placeholder={`متغير ${i + 1}`}
                      value={v}
                      onChange={(e) => setBodyValues((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    />
                  ))}
                </div>
              )}

              {buttonsComp?.buttons.some((b) => b.variablesCount > 0) && (
                <div className="field-group">
                  <span>متغيرات الأزرار</span>
                  {buttonsComp.buttons
                    .filter((b) => b.variablesCount > 0)
                    .map((b) => (
                      <input
                        key={b.index}
                        dir="ltr"
                        placeholder={`قيمة الزر: ${b.text || ''}`}
                        value={buttonValues[b.index] || ''}
                        onChange={(e) => setButtonValues((prev) => ({ ...prev, [b.index]: e.target.value }))}
                      />
                    ))}
                </div>
              )}

              <div className="template-preview">
                <div className="template-preview__label">معاينة الرسالة</div>
                <div className="bubble bubble--agent">
                  <div className="bubble__text">{previewText}</div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              إلغاء
            </button>
            <button type="submit" className="btn btn--primary" disabled={sending || !selectedTemplate}>
              {sending ? 'جارِ الإرسال…' : 'إرسال'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
