import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { translateApiError } from '../utils/apiError';
import { useToast } from '../contexts/ToastContext';
import Button from '../components/ui/Button';

const emptyForm = { name: '', email: '', password: '', role: 'agent' };

export default function Users() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const BackIcon = i18n.dir() === 'rtl' ? ArrowRight : ArrowLeft;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.listUsers();
      setUsers(data.users || []);
      setError('');
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setFormError('');
    try {
      await api.createUser(form);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setFormError(translateApiError(err, t));
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user) {
    try {
      await api.updateUser(user.id, { active: !user.active });
      await load();
    } catch (err) {
      toast.error(translateApiError(err, t));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-16">
      <header className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <BackIcon size={14} /> {t('nav.backToConversations')}
        </Button>
        <h1 className="text-lg font-bold">{t('users.title')}</h1>
      </header>

      <section className="mb-5 rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold">{t('users.addTitle')}</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('users.name')}</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('users.email')}</span>
            <input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('users.password')}</span>
            <input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            <span>{t('users.role')}</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-border px-3 py-2 text-sm font-normal text-text">
              <option value="agent">{t('users.roleAgent')}</option>
              <option value="admin">{t('users.roleAdmin')}</option>
            </select>
          </label>
          {formError && <div className="sm:col-span-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{formError}</div>}
          <Button type="submit" variant="primary" disabled={creating} className="sm:col-span-2 justify-center">
            {creating ? t('users.adding') : t('users.add')}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold">{t('users.currentUsers')}</h2>
        {loading && <div className="py-4 text-center text-sm text-text-muted">{t('app.loading')}</div>}
        {!loading && error && <div className="py-4 text-center text-sm text-danger">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-text-muted">
                  <th className="py-2 text-start">{t('users.name')}</th>
                  <th className="py-2 text-start">{t('users.email')}</th>
                  <th className="py-2 text-start">{t('users.role')}</th>
                  <th className="py-2 text-start">{t('users.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border">
                    <td className="py-2">{u.name}</td>
                    <td className="py-2" dir="ltr">{u.email}</td>
                    <td className="py-2">{u.role === 'admin' ? t('users.roleAdmin') : t('users.roleAgent')}</td>
                    <td className="py-2">{u.active ? t('users.active') : t('users.inactive')}</td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                        {u.active ? t('users.deactivate') : t('users.activate')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
