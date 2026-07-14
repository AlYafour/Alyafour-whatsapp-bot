import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { api } from '../api';
import { translateApiError } from '../utils/apiError';
import ActivityTimeline from '../components/ActivityTimeline';
import TopNav from '../components/TopNav';

export default function Activity() {
  const { t } = useTranslation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getGlobalActivity({ pageSize: 100 });
        setItems(data.rows || []);
      } catch (err) {
        setError(translateApiError(err, t));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav />
      <div className="anim-fade-up mx-auto max-w-3xl px-4 py-6 pb-16">
        <header className="mb-5 flex items-center gap-3">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <History size={18} className="text-brand" />
            {t('activity.globalTitle')}
          </h1>
        </header>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <ActivityTimeline items={items} loading={loading} error={error} tall />
        </div>
      </div>
    </div>
  );
}
