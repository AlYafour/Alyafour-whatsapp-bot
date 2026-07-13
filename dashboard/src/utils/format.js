export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} س`;
  const diffDay = Math.round(diffHr / 24);
  return `منذ ${diffDay} يوم`;
}

export function formatClock(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(expiresAtIso) {
  if (!expiresAtIso) return null;
  const diff = new Date(expiresAtIso).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h} س ${m} د`;
}

export const MESSAGE_TYPE_LABEL = {
  image: 'صورة',
  video: 'فيديو',
  audio: 'رسالة صوتية',
  document: 'مستند',
  location: 'موقع',
  unknown: 'رسالة غير مدعومة',
};

export const MODE_LABEL = { bot: 'بوت', human: 'موظف' };
export const STATUS_LABEL = { open: 'مفتوحة', pending: 'بانتظار موظف', closed: 'مغلقة' };
