import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { formatDuration } from '../utils/format';

const RATES = [1, 1.5, 2];

export default function AudioPlayer({ src }) {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const probingRef = useRef(false);

  // Voice notes recorded by MediaRecorder (ogg/webm) often report
  // duration=Infinity until the element is forced to seek to the end.
  function handleLoadedMetadata(e) {
    const audio = e.currentTarget;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setTotal(audio.duration);
      return;
    }
    probingRef.current = true;
    audio.currentTime = 1e7;
  }

  function handleTimeUpdate(e) {
    const audio = e.currentTarget;
    if (probingRef.current) {
      probingRef.current = false;
      if (Number.isFinite(audio.duration) && audio.duration > 0) setTotal(audio.duration);
      audio.currentTime = 0;
      return;
    }
    setCurrent(audio.currentTime);
    // Some streams only expose the real duration once playback starts.
    if (!total && Number.isFinite(audio.duration) && audio.duration > 0) setTotal(audio.duration);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => setFailed(true));
  }

  function cycleRate() {
    const next = (rateIndex + 1) % RATES.length;
    setRateIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = RATES[next];
  }

  function handleSeek(e) {
    const audio = audioRef.current;
    if (audio && total) audio.currentTime = (Number(e.target.value) / 100) * total;
  }

  function retry() {
    setFailed(false);
    setPlaying(false);
    setCurrent(0);
    setTotal(0);
    setRetryKey((k) => k + 1);
  }

  if (failed) {
    return (
      <button
        type="button"
        onClick={retry}
        className="flex min-w-[220px] items-center justify-center gap-2 rounded-lg bg-black/5 px-3 py-3 text-xs text-danger dark:bg-white/5"
      >
        <RefreshCw size={14} /> {t('message.mediaRetry')}
      </button>
    );
  }

  return (
    <div className="flex min-w-[230px] items-center gap-2.5 py-0.5">
      <audio
        key={retryKey}
        ref={audioRef}
        src={retryKey ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryKey}` : src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onError={() => setFailed(true)}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand to-brand-strong text-white shadow-sm transition-transform active:scale-95"
        aria-label={playing ? 'pause' : 'play'}
      >
        {playing ? <Pause size={15} /> : <Play size={15} className="ms-0.5 rtl:-scale-x-100" />}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={100}
          value={total ? Math.min(100, (current / total) * 100) : 0}
          onChange={handleSeek}
          className="h-1 w-full accent-brand"
        />
        <div className="flex items-center justify-between text-[10px] tabular-nums text-text-muted" dir="ltr">
          <span>{formatDuration(current)}</span>
          <span>{total ? formatDuration(total) : '--:--'}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={cycleRate}
        className="w-9 shrink-0 rounded-full bg-black/5 px-1.5 py-1 text-[11px] font-bold text-text-muted hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
      >
        {RATES[rateIndex]}x
      </button>
    </div>
  );
}
