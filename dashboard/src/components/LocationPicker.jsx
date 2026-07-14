import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Link2, CheckCircle2 } from 'lucide-react';
import Dialog from './ui/Dialog';
import Button from './ui/Button';

// Extracts coordinates from a pasted Google Maps URL (or a raw "lat, lng"
// string). Covers /@lat,lng, ?q=lat,lng, ?ll=, !3dlat!4dlng place links.
export function parseMapsLink(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination|center)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,3}\.\d+)\s*[,،]\s*(-?\d{1,3}\.\d+)$/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export default function LocationPicker({ open, onClose, onSend }) {
  const { t } = useTranslation();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [link, setLink] = useState('');
  const [linkStatus, setLinkStatus] = useState(''); // '' | 'ok' | 'bad'
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  function handleLinkChange(value) {
    setLink(value);
    if (!value.trim()) {
      setLinkStatus('');
      return;
    }
    const coords = parseMapsLink(value);
    if (coords) {
      setLatitude(String(coords.lat));
      setLongitude(String(coords.lng));
      setLinkStatus('ok');
    } else {
      setLinkStatus('bad');
    }
  }

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
        <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={detecting} className="justify-center">
          <MapPin size={15} className="text-brand" />
          {detecting ? t('location.detecting') : t('location.useCurrent')}
        </Button>

        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span className="flex items-center gap-1">
            <Link2 size={12} /> {t('location.pasteLink')}
          </span>
          <div className="relative">
            <input
              dir="ltr"
              value={link}
              onChange={(e) => handleLinkChange(e.target.value)}
              placeholder={t('location.pasteLinkPlaceholder')}
              className={`w-full rounded-lg border px-3 py-2 pe-9 text-sm font-normal text-text ${
                linkStatus === 'bad' ? 'border-danger' : linkStatus === 'ok' ? 'border-brand' : 'border-border'
              }`}
            />
            {linkStatus === 'ok' && (
              <CheckCircle2 size={16} className="absolute top-1/2 -translate-y-1/2 end-3 text-brand" />
            )}
          </div>
          {linkStatus === 'bad' && <span className="font-normal text-danger">{t('location.pasteLinkInvalid')}</span>}
        </label>

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
