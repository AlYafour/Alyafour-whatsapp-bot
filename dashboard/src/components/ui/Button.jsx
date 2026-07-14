const VARIANTS = {
  primary:
    'bg-gradient-to-b from-brand to-brand-strong text-white border-transparent shadow-sm hover:brightness-110 active:brightness-95',
  ghost: 'bg-transparent border-transparent text-text-muted hover:bg-surface-2 hover:text-text',
  danger: 'bg-danger-soft text-danger border-danger/20 hover:brightness-95',
  outline: 'bg-surface border-border shadow-sm hover:bg-surface-2',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

export default function Button({ variant = 'outline', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg border font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
