import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatDuration } from '../utils/format';

const RATES = [1, 1.5, 2];

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
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

  return (
    <div className="flex items-center gap-2 min-w-[220px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setTotal(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white"
        aria-label={playing ? 'pause' : 'play'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={total ? (current / total) * 100 : 0}
        onChange={handleSeek}
        className="h-1 flex-1 accent-brand"
      />
      <span className="text-[11px] tabular-nums text-text-muted w-9 text-end">{formatDuration(total ? total - current : 0)}</span>
      <button type="button" onClick={cycleRate} className="text-[11px] font-semibold text-text-muted w-7">
        {RATES[rateIndex]}x
      </button>
    </div>
  );
}
