import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
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
      if (err.status === 429) setError('محاولات تسجيل دخول كثيرة، يرجى المحاولة لاحقاً');
      else setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>لوحة دعم العملاء</h1>
        <p className="auth-subtitle">اليافور للنقليات والمقاولات العامة</p>

        <label className="field">
          <span>البريد الإلكتروني</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus dir="ltr" />
        </label>

        <label className="field">
          <span>كلمة المرور</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'جارِ الدخول…' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  );
}
