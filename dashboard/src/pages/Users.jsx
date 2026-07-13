import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const emptyForm = { name: '', email: '', password: '', role: 'agent' };

export default function Users() {
  const navigate = useNavigate();
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
      setError(err.message || 'تعذر تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
      setFormError(err.message || 'تعذر إنشاء المستخدم');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user) {
    try {
      await api.updateUser(user.id, { active: !user.active });
      await load();
    } catch (err) {
      setError(err.message || 'تعذر تحديث المستخدم');
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/dashboard')}>
          ← رجوع للمحادثات
        </button>
        <h1>إدارة المستخدمين</h1>
      </header>

      <section className="card">
        <h2>إضافة مستخدم جديد</h2>
        <form className="user-form" onSubmit={handleCreate}>
          <label className="field">
            <span>الاسم</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>البريد الإلكتروني</span>
            <input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="field">
            <span>كلمة المرور</span>
            <input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
          </label>
          <label className="field">
            <span>الدور</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="agent">موظف</option>
              <option value="admin">مدير</option>
            </select>
          </label>
          {formError && <div className="auth-error">{formError}</div>}
          <button type="submit" className="btn btn--primary" disabled={creating}>
            {creating ? 'جارِ الإضافة…' : 'إضافة مستخدم'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>المستخدمون الحاليون</h2>
        {loading && <div className="state-message">جارِ التحميل…</div>}
        {!loading && error && <div className="state-message state-message--error">{error}</div>}
        {!loading && !error && (
          <table className="users-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td dir="ltr">{u.email}</td>
                  <td>{u.role === 'admin' ? 'مدير' : 'موظف'}</td>
                  <td>{u.active ? 'مفعّل' : 'موقوف'}</td>
                  <td>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => toggleActive(u)}>
                      {u.active ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
