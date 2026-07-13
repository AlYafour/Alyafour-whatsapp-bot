import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from './ui/Dialog';
import Button from './ui/Button';

export default function LocationPicker({ open, onClose, onSend }) {
  const { t } = useTranslation();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(t('location.geolocationDenied'));
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        setDetecting(false);
      },
      () => {
        setError(t('location.geolocationDenied'));
        setDetecting(false);
      }
    );
  }

  async function handleSend(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await onSend({ latitude: Number(latitude), longitude: Number(longitude), name, address });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose} title={t('location.title')}>
      <form onSubmit={handleSend} className="flex flex-col gap-3">
        <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={detecting}>
          {detecting ? t('location.detecting') : t('location.useCurrent')}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('location.latitude')}</span>
            <input dir="ltr" value={latitude} onChange={(e) => setLatitude(e.target.value)} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('location.longitude')}</span>
            <input dir="ltr" value={longitude} onChange={(e) => setLongitude(e.target.value)} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span>{t('location.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span>{t('location.address')}</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
        </label>

        {error && <div className="text-xs text-danger">{error}</div>}

        <Button type="submit" variant="primary" disabled={sending || !latitude || !longitude} className="justify-center">
          {t('location.send')}
        </Button>
      </form>
    </Dialog>
  );
}
