import { useCallback, useRef, useState } from 'react';

// WhatsApp Cloud API only accepts audio/aac, audio/mp4, audio/mpeg,
// audio/amr, and audio/ogg (opus codec only) for voice/audio messages.
// Safari's MediaRecorder produces audio/mp4 directly (compatible); Firefox
// can produce audio/ogg;codecs=opus directly (compatible); Chrome/Edge only
// expose audio/webm (NOT compatible) — for those we attempt an in-browser
// ffmpeg.wasm re-encode to audio/ogg as a progressive enhancement, and fall
// back to a clear "unsupported format" state rather than ever sending a
// file WhatsApp would reject.
const PREFERRED_MIME_TYPES = ['audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
const META_COMPATIBLE_BASE = ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return null;
}

function isMetaCompatible(mimeType) {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  return META_COMPATIBLE_BASE.includes(base);
}

let ffmpegInstance = null;
async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

async function convertToOgg(blob) {
  const { fetchFile } = await import('@ffmpeg/util');
  const ffmpeg = await getFfmpeg();
  const inputName = 'input.webm';
  const outputName = 'output.ogg';
  await ffmpeg.writeFile(inputName, await fetchFile(blob));
  await ffmpeg.exec(['-i', inputName, '-c:a', 'libopus', outputName]);
  const data = await ffmpeg.readFile(outputName);
  return new Blob([data.buffer], { type: 'audio/ogg' });
}

export function useVoiceRecorder() {
  const [state, setState] = useState('idle'); // idle | requesting | recording | processing | ready | error
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { blob, mimeType, compatible }

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearInterval(timerRef.current);
  }, []);

  const start = useCallback(async () => {
    setError('');
    setResult(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError('unsupported');
      return;
    }

    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      if (!mimeType) {
        stopStream();
        setState('error');
        setError('unsupported');
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopStream();
        const rawBlob = new Blob(chunksRef.current, { type: mimeType });

        if (isMetaCompatible(mimeType)) {
          setResult({ blob: rawBlob, mimeType, compatible: true });
          setState('ready');
          return;
        }

        // Progressive enhancement: try a client-side re-encode so Chrome/Edge
        // users can still send a real voice note.
        setState('processing');
        try {
          const converted = await convertToOgg(rawBlob);
          setResult({ blob: converted, mimeType: 'audio/ogg', compatible: true });
          setState('ready');
        } catch (err) {
          console.error('[voice recorder] conversion failed:', err);
          setResult({ blob: rawBlob, mimeType, compatible: false });
          setState('ready');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
      setState('recording');
    } catch (err) {
      stopStream();
      setState('error');
      setError(err.name === 'NotAllowedError' ? 'permission-denied' : 'unsupported');
    }
  }, [stopStream]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    stopStream();
    setState('idle');
    setResult(null);
    setDuration(0);
  }, [stopStream]);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setDuration(0);
    setError('');
  }, []);

  return { state, duration, error, result, start, stop, cancel, reset };
}
