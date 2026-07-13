import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { setLanguage } from '../i18n';
import { DropdownMenu, DropdownItem } from './ui/DropdownMenu';
import { Tooltip } from './ui/Tooltip';

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();

  return (
    <DropdownMenu
      trigger={
        <Tooltip label={t('language.switch')}>
          <button
            type="button"
            aria-label={t('language.switch')}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface p-2 hover:bg-surface-2"
          >
            <Languages size={16} />
          </button>
        </Tooltip>
      }
    >
      <DropdownItem onSelect={() => setLanguage('ar')} data-active={i18n.language === 'ar'}>
        {t('language.ar')}
      </DropdownItem>
      <DropdownItem onSelect={() => setLanguage('en')} data-active={i18n.language === 'en'}>
        {t('language.en')}
      </DropdownItem>
    </DropdownMenu>
  );
}
