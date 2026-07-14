import { useTranslation } from 'react-i18next';
import { Bot, UserRound } from 'lucide-react';
import Avatar from './Avatar';
import { formatRelativeTime } from '../utils/format';

export default function ConversationListItem({ conversation, active, onClick }) {
  const { t, i18n } = useTranslation();
  const label = conversation.customer_name || conversation.wa_id;
  const unread = conversation.unread_count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full gap-2.5 px-3.5 py-3 text-start transition-colors duration-150 ${
        active ? 'bg-brand-soft' : 'hover:bg-surface-2/70'
      }`}
    >
      {/* Active indicator bar */}
      {active && <span className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-brand" />}

      <Avatar label={label} seed={conversation.wa_id} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${unread ? 'font-bold' : 'font-semibold'}`}>{label}</span>
          <span className={`shrink-0 text-[11px] ${unread ? 'font-bold text-brand' : 'text-text-muted'}`}>
            {formatRelativeTime(conversation.last_message_at, i18n.language)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${unread ? 'font-semibold text-text' : 'text-text-muted'}`}>
            {conversation.last_message_preview || '—'}
          </span>
          {unread && (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong px-1.5 text-[10px] font-bold text-white shadow-sm">
              {conversation.unread_count}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              conversation.mode === 'human' ? 'bg-pending-soft text-pending' : 'bg-brand-soft text-brand-strong'
            }`}
          >
            {conversation.mode === 'human' ? <UserRound size={10} /> : <Bot size={10} />}
            {t(`mode.${conversation.mode}`)}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              conversation.status === 'pending'
                ? 'bg-danger-soft text-danger'
                : conversation.status === 'closed'
                  ? 'bg-surface-2 text-text-muted'
                  : 'bg-surface-2 text-text-muted'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                conversation.status === 'pending' ? 'animate-pulse bg-danger' : conversation.status === 'closed' ? 'bg-text-muted' : 'bg-brand'
              }`}
            />
            {t(`status.${conversation.status}`)}
          </span>
        </div>
      </div>
    </button>
  );
}
