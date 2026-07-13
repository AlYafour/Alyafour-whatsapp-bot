const LOCALE = { ar: 'ar-AE', en: 'en-US' };

function locale(lang) {
  return LOCALE[lang] || LOCALE.ar;
}

export function formatRelativeTime(dateStr, lang) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto', style: 'short' });
  if (diffMin < 1) return rtf.format(0, 'minute');
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(-diffDay, 'day');
}

export function formatClock(dateStr, lang) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCountdown(expiresAtIso, lang) {
  if (!expiresAtIso) return null;
  const diff = new Date(expiresAtIso).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return lang === 'en' ? `${h}h ${m}m` : `${h} س ${m} د`;
}

export function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function formatDateSeparator(dateStr, lang, t) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return t('message.dateSeparatorToday');
  if (isSameDay(date, yesterday)) return t('message.dateSeparatorYesterday');
  return date.toLocaleDateString(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' });
}
