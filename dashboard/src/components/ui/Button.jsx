const VARIANTS = {
  primary: 'bg-brand text-white border-brand hover:bg-brand-strong',
  ghost: 'bg-transparent border-border hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger border-danger/30 hover:brightness-95',
  outline: 'bg-surface border-border hover:bg-surface-2',
};

const SIZES = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3.5 py-2 gap-2',
};

export default function Button({ variant = 'outline', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg border font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
