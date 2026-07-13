import { useCallback, useEffect, useRef } from 'react';

// A short two-tone chime synthesized with the Web Audio API — no binary
// asset to bundle or license, and it works offline. Browsers suspend
// AudioContext until a user gesture occurs (autoplay policy); we unlock it
// on the first click/keydown anywhere in the app.
export function useNotificationSound() {
  const ctxRef = useRef(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    return ctxRef.current;
  }, []);

  useEffect(() => {
    const unlock = () => {
      const ctx = getContext();
      ctx?.resume?.().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [getContext]);

  return useCallback(() => {
    try {
      const ctx = getContext();
      if (!ctx || ctx.state === 'suspended') return; // respects autoplay restrictions — silently skip

      const now = ctx.currentTime;
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.09;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {
      // Never let a notification sound crash the app.
    }
  }, [getContext]);
}
