import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessagesSquare, Users as UsersIcon, History, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import Avatar from './Avatar';

// App-wide top navigation bar. `children` hosts page-specific actions
// (e.g. the notifications bell on the conversations page).
export default function TopNav({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = [
    { to: '/dashboard', label: t('nav.conversations'), icon: MessagesSquare, exact: true },
    ...(user?.role === 'admin'
      ? [
          { to: '/dashboard/users', label: t('nav.users'), icon: UsersIcon },
          { to: '/dashboard/activity', label: t('nav.activity'), icon: History },
        ]
      : []),
  ];

  return (
    <header className="relative z-20 shrink-0 border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-border">
            <img src="/icons/logo.png" alt="Al Yafour" className="h-full w-full object-contain" />
          </div>
          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-sm font-bold leading-tight">{t('app.name')}</div>
            <div className="truncate text-[10px] text-text-muted">{t('app.dashboardTitle')}</div>
          </div>
        </div>

        <nav className="ms-1 flex items-center gap-1 sm:ms-3">
          {items.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-brand-soft text-brand-strong shadow-inner'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
          {children}
          <ThemeToggle />
          <LanguageToggle />
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <div className="hidden items-center gap-2 rounded-full bg-surface-2/70 py-1 ps-1 pe-3 sm:flex">
            <Avatar label={user?.name} seed={user?.email || user?.name} className="h-7 w-7 text-[11px]" />
            <div className="leading-tight">
              <div className="max-w-28 truncate text-xs font-bold">{user?.name}</div>
              <div className="text-[10px] text-brand-strong">
                {user?.role === 'admin' ? t('sidebar.roleAdmin') : t('sidebar.roleAgent')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label={t('auth.logout')}
            title={t('auth.logout')}
            className="inline-flex items-center justify-center rounded-xl p-2 text-text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
      {/* Brand accent hairline */}
      <div className="h-[3px] bg-gradient-to-r from-brand via-amber-400 to-brand-strong" />
    </header>
  );
}
