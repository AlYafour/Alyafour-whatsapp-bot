import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { translateApiError } from '../utils/apiError';
import ActivityTimeline from '../components/ActivityTimeline';
import Button from '../components/ui/Button';

export default function Activity() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const BackIcon = i18n.dir() === 'rtl' ? ArrowRight : ArrowLeft;

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
    <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
      <header className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <BackIcon size={14} /> {t('nav.backToConversations')}
        </Button>
        <h1 className="text-lg font-bold">{t('activity.globalTitle')}</h1>
      </header>

      <div className="rounded-xl border border-border bg-surface p-4">
        <ActivityTimeline items={items} loading={loading} error={error} />
      </div>
    </div>
  );
}
