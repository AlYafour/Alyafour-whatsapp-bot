import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Users as UsersIcon, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { translateApiError } from '../utils/apiError';
import { useToast } from '../contexts/ToastContext';
import Button from '../components/ui/Button';
import Avatar from '../components/Avatar';
import TopNav from '../components/TopNav';

const emptyForm = { name: '', email: '', password: '', role: 'agent' };

const inputClass =
  'rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5 text-sm font-normal text-text';

export default function Users() {
  const { t } = useTranslation();
  const toast = useToast();

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
    <div className="min-h-screen bg-bg">
      <TopNav />
      <div className="anim-fade-up mx-auto max-w-3xl px-4 py-6 pb-16">
        <header className="mb-5 flex items-center gap-3">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <UsersIcon size={18} className="text-brand" />
            {t('users.title')}
          </h1>
        </header>

        <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="flex items-center gap-2.5 border-b border-border bg-gradient-to-b from-brand-soft/50 to-transparent px-5 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-strong text-white">
              <UserPlus size={15} />
            </div>
            <h2 className="text-sm font-bold">{t('users.addTitle')}</h2>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3.5 p-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              <span>{t('users.name')}</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              <span>{t('users.email')}</span>
              <input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              <span>{t('users.password')}</span>
              <input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              <span>{t('users.role')}</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                <option value="agent">{t('users.roleAgent')}</option>
                <option value="admin">{t('users.roleAdmin')}</option>
              </select>
            </label>
            {formError && <div className="sm:col-span-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-xs font-semibold text-danger">{formError}</div>}
            <Button type="submit" variant="primary" disabled={creating} className="sm:col-span-2 justify-center">
              {creating && <span className="spinner" />}
              {creating ? t('users.adding') : t('users.add')}
            </Button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-bold">{t('users.currentUsers')}</h2>
          </div>

          {loading && (
            <div className="flex flex-col gap-1 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-1/3 rounded" />
                    <div className="skeleton mt-2 h-2.5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && error && <div className="py-6 text-center text-sm text-danger">{error}</div>}
          {!loading && !error && (
            <ul className="divide-y divide-border">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/50">
                  <Avatar label={u.name} seed={u.email} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{u.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          u.role === 'admin' ? 'bg-brand-soft text-brand-strong' : 'bg-surface-2 text-text-muted'
                        }`}
                      >
                        {u.role === 'admin' && <ShieldCheck size={10} />}
                        {u.role === 'admin' ? t('users.roleAdmin') : t('users.roleAgent')}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          u.active ? 'bg-brand-soft text-brand-strong' : 'bg-danger-soft text-danger'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${u.active ? 'bg-brand' : 'bg-danger'}`} />
                        {u.active ? t('users.active') : t('users.inactive')}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-text-muted" dir="ltr">
                      {u.email}
                    </div>
                  </div>
                  <Button variant={u.active ? 'danger' : 'outline'} size="sm" onClick={() => toggleActive(u)}>
                    {u.active ? t('users.deactivate') : t('users.activate')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
