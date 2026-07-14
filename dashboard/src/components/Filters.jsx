import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

const TAB_KEYS = ['all', 'pending', 'human', 'bot', 'unread', 'closed'];

export default function Filters({ active, onChange, search, onSearchChange }) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border px-3.5 py-2.5">
      <div className="relative mb-2.5">
        <Search size={15} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-muted start-3.5" />
        <input
          type="search"
          className="w-full rounded-full border border-border bg-surface-2/70 py-2 text-sm ps-9 pe-9 placeholder:text-text-muted/70"
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute top-1/2 -translate-y-1/2 end-2.5 rounded-full p-1 text-text-muted hover:bg-surface-2 hover:text-text"
            aria-label="clear"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
              active === key
                ? 'border-transparent bg-gradient-to-b from-brand to-brand-strong text-white shadow-sm'
                : 'border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text'
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
