import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../utils/format';

export default function ConversationListItem({ conversation, active, onClick }) {
  const { t, i18n } = useTranslation();
  const label = conversation.customer_name || conversation.wa_id;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full gap-2.5 border-b border-border px-3.5 py-3 text-start transition-colors hover:bg-surface-2 ${
        active ? 'bg-brand-soft' : ''
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">
        {label.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2">
          <span className="truncate text-sm font-bold">{label}</span>
          <span className="shrink-0 text-[11px] text-text-muted">{formatRelativeTime(conversation.last_message_at, i18n.language)}</span>
        </div>
        <div className="mt-0.5 flex justify-between gap-2">
          <span className="truncate text-xs text-text-muted">{conversation.last_message_preview || '—'}</span>
          {conversation.unread_count > 0 && (
            <span className="shrink-0 rounded-full bg-brand px-1.5 text-[11px] text-white">{conversation.unread_count}</span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${conversation.mode === 'human' ? 'border-pending/30 bg-pending-soft text-pending' : 'border-brand/30 bg-brand-soft text-brand-strong'}`}>
            {t(`mode.${conversation.mode}`)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${conversation.status === 'pending' ? 'border-danger/30 bg-danger-soft text-danger' : 'border-border bg-surface-2 text-text-muted'}`}>
            {t(`status.${conversation.status}`)}
          </span>
        </div>
      </div>
    </button>
  );
}
