import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Plus, Bell, BellOff, History, MessageCircle, MessagesSquare, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { translateApiError } from '../utils/apiError';
import { useNotifications } from '../hooks/useNotifications';
import { usePushSubscription } from '../hooks/usePushSubscription';
import TopNav from '../components/TopNav';
import ConversationListItem from '../components/ConversationListItem';
import MessageBubble from '../components/MessageBubble';
import Composer from '../components/Composer';
import Filters from '../components/Filters';
import ConfirmDialog from '../components/ConfirmDialog';
import NewConversationModal from '../components/NewConversationModal';
import Lightbox from '../components/Lightbox';
import ActivityTimeline from '../components/ActivityTimeline';
import Avatar from '../components/Avatar';
import Dialog from '../components/ui/Dialog';
import Button from '../components/ui/Button';
import { formatCountdown, formatDateSeparator, isSameDay } from '../utils/format';

const POLL_MS = 3000;

const TAB_PARAMS = {
  all: {},
  pending: { status: 'pending' },
  human: { mode: 'human' },
  bot: { mode: 'bot' },
  unread: { unread: 'true' },
  closed: { status: 'closed' },
};

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const BackIcon = i18n.dir() === 'rtl' ? ArrowRight : ArrowLeft;

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmReturnToBot, setConfirmReturnToBot] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [showActivity, setShowActivity] = useState(false);
  const [activityItems, setActivityItems] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();

  const busyRef = useRef(false);
  const messagesEndRef = useRef(null);
  const hiddenRef = useRef(document.hidden);

  const notifications = useNotifications({ userId: user?.id, onOpenConversation: setSelectedId });
  const pushSubscription = usePushSubscription();

  const loadConversations = useCallback(async (silent) => {
    if (!silent) setListLoading(true);
    try {
      const params = { ...TAB_PARAMS[tab], search: search || undefined, pageSize: 50 };
      const data = await api.listConversations(params);
      setConversations(data.rows || []);
      notifications.processPoll(data.rows || []);
      setListError('');
    } catch (err) {
      setListError(translateApiError(err, t));
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  const loadDetail = useCallback(async (id, silent) => {
    if (!id) return;
    if (!silent) setDetailLoading(true);
    try {
      const data = await api.getConversation(id);
      setDetail(data);
      setDetailError('');
    } catch (err) {
      setDetailError(translateApiError(err, t));
    } finally {
      setDetailLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId, false);
  }, [selectedId, loadDetail]);

  // Poll for updates every 3s, paused while the tab is hidden.
  useEffect(() => {
    const onVisibility = () => (hiddenRef.current = document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    const interval = setInterval(async () => {
      if (busyRef.current || hiddenRef.current) return;
      busyRef.current = true;
      try {
        await loadConversations(true);
        if (selectedId) await loadDetail(selectedId, true);
      } finally {
        busyRef.current = false;
      }
    }, POLL_MS);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadConversations, loadDetail, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length]);

  // Opened from a notification click (?conversation=<id> — used by the
  // service worker's openWindow() fallback when no dashboard tab is open).
  useEffect(() => {
    const convId = searchParams.get('conversation');
    if (convId) {
      setSelectedId(convId);
      const next = new URLSearchParams(searchParams);
      next.delete('conversation');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened from a notification click while a dashboard tab was already open
  // (the service worker focuses it and postMessages the conversation id).
  useEffect(() => {
    function onMessage(event) {
      if (event.data?.type === 'OPEN_CONVERSATION' && event.data.conversationId) {
        setSelectedId(event.data.conversationId);
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);

  async function handleSelect(conv) {
    setSelectedId(conv.id);
    setReplyTo(null);
    if (conv.unread_count > 0) {
      try {
        await api.markRead(conv.id);
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)));
      } catch {
        // non-critical
      }
    }
  }

  async function openActivity() {
    setShowActivity(true);
    setActivityLoading(true);
    setActivityError('');
    try {
      const data = await api.getConversationActivity(selectedId);
      setActivityItems(data.activity || []);
    } catch (err) {
      setActivityError(translateApiError(err, t));
    } finally {
      setActivityLoading(false);
    }
  }

  async function withAction(fn) {
    setActionBusy(true);
    try {
      await fn();
      await loadConversations(true);
      if (selectedId) await loadDetail(selectedId, true);
    } catch (err) {
      toast.error(translateApiError(err, t));
    } finally {
      setActionBusy(false);
    }
  }

  async function appendAndRefresh(message) {
    setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
    await loadConversations(true);
  }

  async function handleSendText(text, contextMessageWaId) {
    const { message } = await api.reply(selectedId, text, contextMessageWaId);
    await appendAndRefresh(message);
  }

  function handleSendAttachment(opts) {
    return api.uploadAttachment(selectedId, opts);
  }

  async function handleSendVoice(blob, mimeType, contextMessageWaId) {
    const file = new File([blob], `voice-${Date.now()}.${mimeType.includes('ogg') ? 'ogg' : 'm4a'}`, { type: mimeType });
    const { promise } = api.uploadAttachment(selectedId, {
      file,
      type: 'voice',
      contextMessageWaId,
      idempotencyKey: newIdempotencyKey(),
    });
    const data = await promise;
    await appendAndRefresh(data.message);
  }

  async function handleSendLocation(payload) {
    const { message } = await api.sendLocation(selectedId, payload);
    await appendAndRefresh(message);
  }

  async function handleSendContact(contacts) {
    const { message } = await api.sendContact(selectedId, contacts);
    await appendAndRefresh(message);
  }

  async function handleReact(targetWaMessageId, emoji) {
    try {
      await api.sendReaction(selectedId, targetWaMessageId, emoji);
      await loadDetail(selectedId, true);
    } catch (err) {
      toast.error(translateApiError(err, t));
    }
  }

  // Attachment uploads resolve with { message }, direct api.uploadAttachment
  // consumers need that unwrapped before appendAndRefresh — wrap once here.
  function sendAttachmentWrapped(opts) {
    const handle = handleSendAttachment(opts);
    return { ...handle, promise: handle.promise.then((data) => appendAndRefresh(data.message)) };
  }

  const conversation = detail?.conversation;
  const countdown = detail?.serviceWindow?.expiresAt ? formatCountdown(detail.serviceWindow.expiresAt, i18n.language) : null;

  const { visibleMessages, reactionsMap, contextMap } = useMemo(() => {
    const messages = detail?.messages || [];
    const cMap = new Map(messages.map((m) => [m.wa_message_id, m]));
    const rMap = new Map();
    for (const m of messages) {
      if (m.message_type === 'reaction' && m.reacted_message_wa_id) {
        rMap.set(m.reacted_message_wa_id, m.reaction_emoji);
      }
    }
    return {
      visibleMessages: messages.filter((m) => m.message_type !== 'reaction'),
      reactionsMap: rMap,
      contextMap: cMap,
    };
  }, [detail?.messages]);

  let composerDisabledReason = null;
  if (conversation?.status === 'closed') composerDisabledReason = t('conversation.composerDisabled.closed');
  else if (detail?.serviceWindow && !detail.serviceWindow.open) {
    composerDisabledReason = conversation?.last_customer_message_at
      ? t('conversation.composerDisabled.windowExpired')
      : t('conversation.composerDisabled.awaitingFirstReply');
  }

  return (
    <div className={`flex h-[100dvh] flex-col bg-surface-2 ${selectedId ? '[--pane:flex]' : ''}`}>
      <TopNav>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = !notifications.muted;
            notifications.setMuted(next);
            if (!next && pushSubscription.supported && !pushSubscription.subscribed) pushSubscription.subscribe();
          }}
          aria-label={notifications.muted ? t('notifications.unmute') : t('notifications.mute')}
          title={notifications.permission === 'denied' ? t('notifications.permissionDenied') : undefined}
        >
          {notifications.muted ? <BellOff size={16} /> : <Bell size={16} />}
        </Button>
      </TopNav>

      <div className="flex min-h-0 flex-1">
      <aside className={`${selectedId ? 'hidden' : 'flex'} md:flex w-full md:w-[340px] shrink-0 flex-col border-e border-border bg-surface`}>
        <div className="border-b border-border bg-gradient-to-b from-brand-soft/60 to-transparent px-3.5 py-3">
          <Button variant="primary" onClick={() => setShowNewConversation(true)} className="w-full justify-center">
            <Plus size={15} /> {t('sidebar.newConversation')}
          </Button>
        </div>

        <Filters active={tab} onChange={setTab} search={search} onSearchChange={setSearch} />

        <div className="flex-1 overflow-y-auto">
          {listLoading && (
            <div className="flex flex-col gap-1 p-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl p-2.5">
                  <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-2/3 rounded" />
                    <div className="skeleton mt-2 h-2.5 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!listLoading && listError && <div className="p-6 text-center text-sm text-danger">{listError}</div>}
          {!listLoading && !listError && conversations.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                <MessagesSquare size={24} />
              </div>
              <div className="text-sm text-text-muted">{t('conversationList.empty')}</div>
            </div>
          )}
          {!listLoading &&
            conversations.map((c) => (
              <ConversationListItem key={c.id} conversation={c} active={c.id === selectedId} onClick={() => handleSelect(c)} />
            ))}
        </div>
      </aside>

      <main className={`${selectedId ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
        {!selectedId && (
          <div className="chat-wallpaper flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft text-brand-strong shadow-inner">
              <MessagesSquare size={36} />
            </div>
            <div>
              <div className="text-base font-bold">{t('sidebar.title')}</div>
              <div className="mt-1 text-sm text-text-muted">{t('conversation.selectPrompt')}</div>
            </div>
          </div>
        )}

        {selectedId && detailLoading && !detail && (
          <div className="chat-wallpaper flex flex-1 flex-col items-center justify-center gap-3 text-sm text-text-muted">
            <span className="spinner text-brand" />
            {t('conversation.loadingDetail')}
          </div>
        )}

        {selectedId && detail && conversation && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-surface px-4 py-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <button type="button" onClick={() => setSelectedId(null)} className="md:hidden mt-2 rounded-full p-1.5 text-brand-strong hover:bg-surface-2">
                  <BackIcon size={18} />
                </button>
                <Avatar label={conversation.customer_name || conversation.wa_id} seed={conversation.wa_id} className="h-10 w-10 text-sm" />
                <div>
                  <div className="text-base font-bold leading-tight">{conversation.customer_name || conversation.wa_id}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                    <span dir="ltr">{conversation.wa_id}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${conversation.mode === 'human' ? 'border-pending/30 bg-pending-soft text-pending' : 'border-brand/30 bg-brand-soft text-brand-strong'}`}>
                      {t(`mode.${conversation.mode}`)}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${conversation.status === 'pending' ? 'border-danger/30 bg-danger-soft text-danger' : 'border-border bg-surface-2'}`}>
                      {t(`status.${conversation.status}`)}
                    </span>
                    {conversation.assigned_to_name && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                        {t('conversation.assignedTo', { name: conversation.assigned_to_name })}
                      </span>
                    )}
                    {countdown ? (
                      <span className="rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[11px] text-brand-strong">
                        {t('conversation.windowOpen', { time: countdown })}
                      </span>
                    ) : (
                      <span className="rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] text-danger">
                        {t('conversation.windowClosed')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={openActivity} aria-label={t('activity.conversationTitle')}>
                  <History size={14} />
                </Button>
                {!conversation.assigned_to ? (
                  <Button size="sm" disabled={actionBusy} onClick={() => withAction(() => api.claim(conversation.id))}>
                    {t('conversation.actions.claim')}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled={actionBusy} onClick={() => withAction(() => api.release(conversation.id))}>
                    {t('conversation.actions.release')}
                  </Button>
                )}
                {conversation.mode === 'bot' && (
                  <Button size="sm" disabled={actionBusy} onClick={() => withAction(() => api.switchToHuman(conversation.id))}>
                    {t('conversation.actions.switchToHuman')}
                  </Button>
                )}
                {conversation.mode === 'human' && (
                  <Button size="sm" variant="ghost" disabled={actionBusy} onClick={() => setConfirmReturnToBot(true)}>
                    {t('conversation.actions.returnToBot')}
                  </Button>
                )}
                {conversation.status !== 'closed' ? (
                  <Button size="sm" variant="danger" disabled={actionBusy} onClick={() => withAction(() => api.close(conversation.id))}>
                    {t('conversation.actions.close')}
                  </Button>
                ) : (
                  <Button size="sm" disabled={actionBusy} onClick={() => withAction(() => api.reopen(conversation.id))}>
                    {t('conversation.actions.reopen')}
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actionBusy}
                    onClick={() => setConfirmDelete(true)}
                    aria-label={t('conversation.actions.delete')}
                    className="hover:!bg-danger-soft hover:!text-danger"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </header>

            {detailError && <div className="px-4 py-2 text-center text-sm text-danger">{detailError}</div>}

            <div className="chat-wallpaper flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-5">
              {visibleMessages.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-text-muted">
                  <MessageCircle size={28} className="opacity-40" />
                  {t('conversation.noMessages')}
                </div>
              )}
              {visibleMessages.map((m, i) => {
                const prev = visibleMessages[i - 1];
                const showSeparator = !prev || !isSameDay(prev.created_at, m.created_at);
                return (
                  <div key={m.id}>
                    {showSeparator && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-full bg-surface px-3 py-1 text-[11px] text-text-muted shadow-sm">
                          {formatDateSeparator(m.created_at, i18n.language, t)}
                        </span>
                      </div>
                    )}
                    <div className="bubble-enter mb-1.5">
                      <MessageBubble
                        message={m}
                        contextMessage={m.context_message_wa_id ? contextMap.get(m.context_message_wa_id) : null}
                        reactionEmoji={reactionsMap.get(m.wa_message_id)}
                        onReply={m.message_type !== 'system' ? setReplyTo : null}
                        onReact={m.message_type !== 'system' ? handleReact : null}
                        onOpenLightbox={setLightboxSrc}
                      />
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <Composer
              disabled={!!composerDisabledReason}
              disabledReason={composerDisabledReason}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSendText={handleSendText}
              onSendAttachment={sendAttachmentWrapped}
              onSendVoice={handleSendVoice}
              onSendLocation={handleSendLocation}
              onSendContact={handleSendContact}
            />
          </>
        )}
      </main>
      </div>

      <ConfirmDialog
        open={confirmReturnToBot}
        title={t('conversation.confirmReturnToBot.title')}
        message={t('conversation.confirmReturnToBot.message')}
        confirmLabel={t('conversation.confirmReturnToBot.confirm')}
        cancelLabel={t('conversation.confirmReturnToBot.cancel')}
        onCancel={() => setConfirmReturnToBot(false)}
        onConfirm={() => {
          setConfirmReturnToBot(false);
          withAction(() => api.returnToBot(conversation.id));
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('conversation.confirmDelete.title')}
        message={t('conversation.confirmDelete.message')}
        confirmLabel={t('conversation.confirmDelete.confirm')}
        cancelLabel={t('conversation.confirmDelete.cancel')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          setActionBusy(true);
          try {
            await api.deleteConversation(selectedId);
            setSelectedId(null);
            setDetail(null);
            await loadConversations(true);
          } catch (err) {
            toast.error(translateApiError(err, t));
          } finally {
            setActionBusy(false);
          }
        }}
      />

      <NewConversationModal
        open={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onCreated={async (conv) => {
          setShowNewConversation(false);
          await loadConversations(true);
          setSelectedId(conv.id);
        }}
      />

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      <Dialog open={showActivity} onOpenChange={setShowActivity} title={t('activity.conversationTitle')}>
        <ActivityTimeline items={activityItems} loading={activityLoading} error={activityError} />
      </Dialog>
    </div>
  );
}
