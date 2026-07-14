import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Trash2, Send, X } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { formatDuration } from '../utils/format';
import Button from './ui/Button';

export default function VoiceRecorder({ onSend, onClose }) {
  const { t } = useTranslation();
  const { state, duration, error, result, level, start, stop, cancel, reset } = useVoiceRecorder();

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
        <span>{error === 'permission-denied' ? t('recorder.permissionDenied') : t('recorder.unsupported')}</span>
        <button type="button" onClick={onClose} aria-label={t('recorder.cancel')}>
          <X size={16} />
        </button>
      </div>
    );
  }

  if (state === 'requesting') {
    return <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">{t('app.loading')}</div>;
  }

  if (state === 'processing') {
    return <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">{t('recorder.preparing')}</div>;
  }

  if (state === 'recording') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-danger text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" />
            {t('recorder.recording')} · {formatDuration(duration)}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancel} className="rounded-lg p-2 hover:bg-black/5" aria-label={t('recorder.cancel')}>
              <X size={16} />
            </button>
            <Button type="button" variant="danger" size="sm" onClick={stop}>
              <Square size={14} /> {t('recorder.stop')}
            </Button>
          </div>
        </div>
        {/* Live microphone level — if this never moves, the mic hears nothing */}
        <div className="flex items-center gap-2">
          <Mic size={13} className={level > 0.03 ? 'text-brand' : 'text-text-muted'} />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-150 ${level > 0.03 ? 'bg-brand' : 'bg-danger'}`}
              style={{ width: `${Math.max(2, Math.round(level * 100))}%` }}
            />
          </div>
        </div>
        {duration >= 2 && level < 0.01 && (
          <div className="text-[11px] font-semibold text-danger">{t('recorder.noSignal')}</div>
        )}
      </div>
    );
  }

  if (state === 'ready' && result) {
    const audioUrl = URL.createObjectURL(result.blob);
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
        {!result.compatible && (
          <div className="text-xs text-danger">{t('recorder.unsupported')}</div>
        )}
        {result.silent && (
          <div className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
            {t('recorder.silentWarning')}
          </div>
        )}
        <div className="flex items-center gap-3">
          <audio src={audioUrl} controls className="h-9 flex-1" />
          <Button type="button" variant="ghost" size="sm" onClick={() => { reset(); start(); }} aria-label={t('recorder.delete')}>
            <Trash2 size={14} />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!result.compatible}
            onClick={() => onSend(result.blob, result.mimeType)}
          >
            <Send size={14} /> {t('recorder.send')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={start} className="flex items-center gap-2 text-sm text-text-muted">
      <Mic size={16} /> {t('recorder.start')}
    </button>
  );
}
