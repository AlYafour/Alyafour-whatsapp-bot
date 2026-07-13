import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from './ui/Dialog';
import Button from './ui/Button';

export default function ContactPicker({ open, onClose, onSend }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const contacts = [
        {
          name: { formatted_name: name },
          phones: [{ phone }],
          emails: email ? [{ email }] : [],
        },
      ];
      await onSend(contacts);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose} title={t('contact.title')}>
      <form onSubmit={handleSend} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span>{t('contact.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span>{t('contact.phone')}</span>
          <input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span>{t('contact.email')}</span>
          <input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
        </label>

        {error && <div className="text-xs text-danger">{error}</div>}

        <Button type="submit" variant="primary" disabled={sending || !name || !phone} className="justify-center">
          {t('contact.send')}
        </Button>
      </form>
    </Dialog>
  );
}
