import { useCallback, useEffect, useRef, useState } from 'react';
import { detectNewInboundActivity, sumUnread, safePreview, buildTabTitle } from '../utils/notifications';
import { useNotificationSound } from './useNotificationSound';

const MUTE_KEY_PREFIX = 'ay-mute-';

// Combines: mute/unmute (persisted per logged-in user), a short chime for
// genuinely new inbound customer messages, desktop Notification permission
// + display, and the "(N) …" browser tab title. Duplicate polling results
// never re-trigger anything because the diff is against unread_count, which
// only changes server-side when something real happened.
export function useNotifications({ userId, onOpenConversation }) {
  const playSound = useNotificationSound();
  const [muted, setMutedState] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const baseTitleRef = useRef(typeof document !== 'undefined' ? document.title : '');
  const prevConversationsRef = useRef([]);
  const isFirstPollRef = useRef(true);

  useEffect(() => {
    if (!userId) return;
    setMutedState(localStorage.getItem(MUTE_KEY_PREFIX + userId) === '1');
  }, [userId]);

  const setMuted = useCallback(
    (next) => {
      setMutedState(next);
      if (userId) localStorage.setItem(MUTE_KEY_PREFIX + userId, next ? '1' : '0');
    },
    [userId]
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Ask once, proactively, the first time the dashboard mounts (a user
  // gesture already happened — logging in) — browsers allow this.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifyNewActivity = useCallback(
    (conversation) => {
      if (muted) return;
      playSound();

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const title = conversation.customer_name || conversation.wa_id;
        const body = safePreview(conversation.last_message_preview);
        const notification = new Notification(title, { body, tag: `ay-conv-${conversation.id}`, icon: '/icons/icon.svg' });
        notification.onclick = () => {
          window.focus();
          onOpenConversation?.(conversation.id);
          notification.close();
        };
      }
    },
    [muted, playSound, onOpenConversation]
  );

  // Call this every time the conversation list is (re)fetched — initial
  // load included. It diffs internally against the previous call's data.
  const processPoll = useCallback(
    (nextConversations) => {
      if (!isFirstPollRef.current) {
        const activity = detectNewInboundActivity(prevConversationsRef.current, nextConversations);
        activity.forEach(({ conversation }) => notifyNewActivity(conversation));
      }
      isFirstPollRef.current = false;
      prevConversationsRef.current = nextConversations;
      document.title = buildTabTitle(baseTitleRef.current, sumUnread(nextConversations));
    },
    [notifyNewActivity]
  );

  useEffect(() => {
    return () => {
      document.title = baseTitleRef.current;
    };
  }, []);

  return { muted, setMuted, permission, requestPermission, processPoll };
}
