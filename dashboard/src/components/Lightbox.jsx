import { useTranslation } from 'react-i18next';
import { X, Download } from 'lucide-react';

export default function Lightbox({ src, onClose }) {
  const { t } = useTranslation();
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('nav.back')}
        className="absolute top-4 end-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X size={20} />
      </button>
      <a
        href={src}
        download
        onClick={(e) => e.stopPropagation()}
        aria-label={t('message.download')}
        className="absolute top-4 start-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <Download size={20} />
      </a>
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-full rounded-lg object-contain"
      />
    </div>
  );
}
