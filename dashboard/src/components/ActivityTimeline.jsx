import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import Avatar from './Avatar';
import { formatRelativeTime } from '../utils/format';

export default function ActivityTimeline({ items, loading, error, tall = false }) {
  const { t, i18n } = useTranslation();

  if (loading) {
    return (
      <div className="flex flex-col gap-1 py-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="skeleton h-9 w-9 rounded-full" />
            <div className="flex-1">
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton mt-2 h-2.5 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) return <div className="py-6 text-center text-sm text-danger">{error}</div>;
  if (!items?.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-text-muted">
        <Inbox size={26} className="opacity-40" />
        {t('empty.generic')}
      </div>
    );
  }

  return (
    <ul className={`flex flex-col gap-1.5 overflow-y-auto ${tall ? 'max-h-[70vh]' : 'max-h-96'}`}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface px-3.5 py-2.5 text-sm transition-colors hover:bg-surface-2/50"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <Avatar label={item.actor_name || '?'} seed={item.actor_name || 'system'} className="h-8 w-8 text-xs" />
            <div className="min-w-0">
              <div>
                <span className="font-bold">{item.actor_name || t('activity.unknownActor')}</span>{' '}
                <span className="text-text-muted">{t(`activity.actions.${item.action}`, item.action)}</span>
              </div>
              {item.conversation_wa_id && (
                <div className="mt-0.5 truncate text-xs text-brand-strong" dir="ltr">
                  {item.conversation_customer_name || item.conversation_wa_id}
                </div>
              )}
            </div>
          </div>
          <span
            className="shrink-0 text-[11px] text-text-muted"
            title={new Date(item.created_at).toLocaleString(i18n.language === 'ar' ? 'ar-AE' : 'en-US')}
          >
            {formatRelativeTime(item.created_at, i18n.language)}
          </span>
        </li>
      ))}
    </ul>
  );
}
