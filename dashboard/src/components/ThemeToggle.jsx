import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// One-click light/dark toggle. The icon shows the mode you'll switch TO.
export default function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));

  return (
    <button
      type="button"
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      aria-label={t('theme.toggle')}
      title={isDark ? t('theme.light') : t('theme.dark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-muted shadow-sm transition-colors hover:bg-surface-2 hover:text-text"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
