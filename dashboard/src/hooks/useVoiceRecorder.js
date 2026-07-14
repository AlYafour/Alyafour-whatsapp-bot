import { useCallback, useRef, useState } from 'react';

// WhatsApp voice notes are strict: OGG container + Opus codec, mono.
// Browsers record whatever they support (webm/opus on Chrome and Edge,
// mp4 on Safari, ogg/opus on Firefox) — anything that is not already
// ogg/opus gets re-encoded in the browser via ffmpeg.wasm to mono 48kHz
// OGG-Opus so the file both delivers on the customer's phone and plays
// back in the dashboard.
const PREFERRED_MIME_TYPES = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function isVoiceReady(mimeType) {
  return (mimeType || '').split(';')[0].trim().toLowerCase() === 'audio/ogg';
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

async function convertToOgg(blob, sourceMime) {
  const { fetchFile } = await import('@ffmpeg/util');
  const ffmpeg = await getFfmpeg();
  const ext = (sourceMime || '').includes('mp4') || (sourceMime || '').includes('aac') ? 'mp4' : 'webm';
  const inputName = `input.${ext}`;
  const outputName = 'output.ogg';
  await ffmpeg.writeFile(inputName, await fetchFile(blob));
  // WhatsApp voice spec: OGG-Opus, mono, 48kHz. -application voip tunes
  // the encoder for speech.
  await ffmpeg.exec(['-i', inputName, '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', outputName]);
  const data = await ffmpeg.readFile(outputName);
  if (!data || data.length < 100) throw new Error('conversion produced an empty file');
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

        if (rawBlob.size < 100) {
          setState('error');
          setError('unsupported');
          return;
        }

        if (isVoiceReady(mimeType)) {
          setResult({ blob: rawBlob, mimeType: 'audio/ogg', compatible: true });
          setState('ready');
          return;
        }

        // Anything that is not ogg/opus gets re-encoded so WhatsApp both
        // accepts AND delivers it as a real voice note.
        setState('processing');
        try {
          const converted = await convertToOgg(rawBlob, mimeType);
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
