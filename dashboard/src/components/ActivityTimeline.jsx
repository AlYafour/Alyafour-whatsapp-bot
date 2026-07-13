import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../utils/format';

export default function ActivityTimeline({ items, loading, error }) {
  const { t, i18n } = useTranslation();

  if (loading) return <div className="py-4 text-center text-sm text-text-muted">{t('app.loading')}</div>;
  if (error) return <div className="py-4 text-center text-sm text-danger">{error}</div>;
  if (!items?.length) return <div className="py-4 text-center text-sm text-text-muted">{t('empty.generic')}</div>;

  return (
    <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <div className="min-w-0">
            <span className="font-semibold">{item.actor_name || t('activity.unknownActor')}</span>{' '}
            <span className="text-text-muted">{t(`activity.actions.${item.action}`, item.action)}</span>
            {item.conversation_wa_id && (
              <div className="mt-0.5 truncate text-xs text-text-muted" dir="ltr">
                {item.conversation_customer_name || item.conversation_wa_id}
              </div>
            )}
          </div>
          <span
            className="shrink-0 text-xs text-text-muted"
            title={new Date(item.created_at).toLocaleString(i18n.language === 'ar' ? 'ar-AE' : 'en-US')}
          >
            {formatRelativeTime(item.created_at, i18n.language)}
          </span>
        </li>
      ))}
    </ul>
  );
}
