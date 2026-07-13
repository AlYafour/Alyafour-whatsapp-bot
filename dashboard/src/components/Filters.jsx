import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

const TAB_KEYS = ['all', 'pending', 'human', 'bot', 'unread', 'closed'];

export default function Filters({ active, onChange, search, onSearchChange }) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border px-3.5 py-2.5">
      <div className="relative mb-2">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-muted start-3" />
        <input
          type="search"
          className="w-full rounded-full border border-border bg-surface-2 py-1.5 text-sm ps-8 pe-3"
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active === key ? 'border-brand bg-brand text-white' : 'border-border bg-bg text-text-muted hover:bg-surface-2'
            }`}
            onClick={() => onChange(key)}
          >
            {t(`filters.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
