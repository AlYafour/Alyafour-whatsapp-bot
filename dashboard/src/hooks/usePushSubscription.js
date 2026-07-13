import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { urlBase64ToUint8Array } from '../utils/notifications';

// Web Push only if it's actually available and VAPID is configured
// server-side — degrades to a no-op everywhere else (in-app sound/desktop
// Notification still work regardless).
export function usePushSubscription() {
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (!cancelled) setSubscribed(!!existing);
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    try {
      const { publicKey } = await api.getVapidPublicKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.pushSubscribe(sub.toJSON());
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[push] subscribe failed:', err.message);
      return false;
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, [supported]);

  return { supported, subscribed, subscribe, unsubscribe };
}
