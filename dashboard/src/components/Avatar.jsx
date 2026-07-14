// Deterministic gradient avatar: the same contact always gets the same colors.
const GRADIENTS = [
  'from-emerald-500 to-teal-700',
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-purple-700',
  'from-rose-500 to-pink-700',
  'from-amber-500 to-orange-700',
  'from-cyan-500 to-blue-700',
  'from-lime-500 to-green-700',
  'from-fuchsia-500 to-violet-700',
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
