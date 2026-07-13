import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import Button from '../components/ui/Button';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.status === 429 ? t('auth.login.rateLimited') : t('auth.login.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand to-brand-strong">
      <div className="absolute top-4 inset-x-4 flex justify-between">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-2xl flex flex-col gap-3.5">
        <h1 className="text-center text-xl font-bold text-brand-strong">{t('auth.login.title')}</h1>
        <p className="text-center text-xs text-text-muted -mt-2 mb-2">{t('auth.login.subtitle')}</p>

        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span>{t('auth.login.email')}</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          <span>{t('auth.login.password')}</span>
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text"
          />
        </label>

        {error && <div className="rounded-lg bg-danger-soft text-danger text-xs text-center py-2 px-2">{error}</div>}

        <Button type="submit" variant="primary" disabled={busy} className="w-full mt-1 justify-center">
          {busy ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
    </div>
  );
}
