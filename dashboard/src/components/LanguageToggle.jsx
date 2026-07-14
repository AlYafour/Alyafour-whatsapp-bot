import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';

// One-click Arabic/English toggle. The label shows the language you'll switch TO.
export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      aria-label={t('language.switch')}
      title={next === 'ar' ? t('language.ar') : t('language.en')}
      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-2.5 text-xs font-bold text-text-muted shadow-sm transition-colors hover:bg-surface-2 hover:text-text"
    >
      {next === 'ar' ? 'عربي' : 'EN'}
    </button>
  );
}
