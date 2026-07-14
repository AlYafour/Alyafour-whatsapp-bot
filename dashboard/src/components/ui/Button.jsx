const VARIANTS = {
  primary:
    'bg-gradient-to-b from-brand to-brand-strong text-white border-transparent shadow-sm hover:brightness-110 active:brightness-95',
  ghost: 'bg-transparent border-transparent text-text-muted hover:bg-surface-2 hover:text-text',
  danger: 'bg-danger-soft text-danger border-danger/25 hover:brightness-95',
  outline: 'bg-surface border-border shadow-sm hover:bg-surface-2',
};

const SIZES = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
};

export default function Button({ variant = 'outline', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl border font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
