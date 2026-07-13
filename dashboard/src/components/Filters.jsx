const TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'بانتظار التحويل' },
  { key: 'human', label: 'موظف' },
  { key: 'bot', label: 'بوت' },
  { key: 'unread', label: 'غير مقروء' },
  { key: 'closed', label: 'مغلقة' },
];

export default function Filters({ active, onChange, search, onSearchChange }) {
  return (
    <div className="filters">
      <input
        type="search"
        className="filters__search"
        placeholder="ابحث بالاسم أو الرقم…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="filters__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`filters__tab ${active === tab.key ? 'filters__tab--active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
