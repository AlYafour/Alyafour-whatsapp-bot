// Deterministic gradient avatar: the same contact always gets the same colors.
const GRADIENTS = [
  'from-orange-400 to-orange-600',
  'from-slate-500 to-slate-700',
  'from-amber-500 to-orange-700',
  'from-sky-500 to-indigo-600',
  'from-rose-500 to-pink-700',
  'from-teal-500 to-emerald-700',
  'from-violet-500 to-purple-700',
  'from-stone-500 to-stone-700',
];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({ label, seed, className = 'h-11 w-11 text-base' }) {
  const gradient = GRADIENTS[hashCode(String(seed || label || '?')) % GRADIENTS.length];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white shadow-sm ring-2 ring-surface ${className}`}
    >
      {String(label || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}
