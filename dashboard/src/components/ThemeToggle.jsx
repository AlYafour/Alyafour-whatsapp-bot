import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DropdownMenu, DropdownItem } from './ui/DropdownMenu';
import { Tooltip } from './ui/Tooltip';

const ICONS = { light: Sun, dark: Moon, system: Monitor };

export default function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const Icon = ICONS[mode];

  return (
    <DropdownMenu
      trigger={
        <Tooltip label={t('theme.toggle')}>
          <button
            type="button"
            aria-label={t('theme.toggle')}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface p-2 hover:bg-surface-2"
          >
            <Icon size={16} />
          </button>
        </Tooltip>
      }
    >
      <DropdownItem icon={Sun} onSelect={() => setMode('light')}>
        {t('theme.light')}
      </DropdownItem>
      <DropdownItem icon={Moon} onSelect={() => setMode('dark')}>
        {t('theme.dark')}
      </DropdownItem>
      <DropdownItem icon={Monitor} onSelect={() => setMode('system')}>
        {t('theme.system')}
      </DropdownItem>
    </DropdownMenu>
  );
}
