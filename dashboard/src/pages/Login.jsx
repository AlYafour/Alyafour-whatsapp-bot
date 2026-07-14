import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="login-gradient relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -top-24 -start-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -end-24 h-96 w-96 rounded-full bg-black/15 blur-3xl" />

      <div className="absolute top-4 inset-x-4 flex justify-between">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <form
        onSubmit={handleSubmit}
        className="anim-fade-up relative w-full max-w-sm rounded-3xl bg-surface p-8 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-white shadow-lg">
            <MessageCircle size={30} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">{t('auth.login.title')}</h1>
            <p className="mt-1 text-xs text-text-muted">{t('auth.login.subtitle')}</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
          <span>{t('auth.login.email')}</span>
          <div className="relative">
            <Mail size={15} className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 text-text-muted" />
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-surface-2/50 ps-10 pe-3.5 py-2.5 text-sm font-normal text-text"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
          <span>{t('auth.login.password')}</span>
          <div className="relative">
            <Lock size={15} className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 text-text-muted" />
            <input
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-surface-2/50 ps-10 pe-11 py-2.5 text-sm font-normal text-text"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 -translate-y-1/2 end-3 rounded-md p-1 text-text-muted hover:text-text"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>

        {error && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-xs font-semibold text-danger">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full justify-center py-2.5">
          {busy && <span className="spinner" />}
          {busy ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
    </div>
  );
}
