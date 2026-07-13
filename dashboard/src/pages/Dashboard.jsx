import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ConversationListItem from '../components/ConversationListItem';
import MessageBubble from '../components/MessageBubble';
import Composer from '../components/Composer';
import Filters from '../components/Filters';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCountdown, MODE_LABEL, STATUS_LABEL } from '../utils/format';

const POLL_MS = 3000;

const TAB_PARAMS = {
  all: {},
  pending: { status: 'pending' },
  human: { mode: 'human' },
  bot: { mode: 'bot' },
  unread: { unread: 'true' },
  closed: { status: 'closed' },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  const busyRef = useRef(false);
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(async (silent) => {
    if (!silent) setListLoading(true);
    try {
      const params = { ...TAB_PARAMS[tab], search: search || undefined, pageSize: 50 };
      const data = await api.listConversations(params);
      setConversations(data.rows || []);
      setListError('');
    } catch (err) {
      setListError(err.message || 'تعذر تحميل المحادثات');
    } finally {
      setListLoading(false);
    }
  }, [tab, search]);

  const loadDetail = useCallback(async (id, silent) => {
    if (!id) return;
    if (!silent) setDetailLoading(true);
    try {
      const data = await api.getConversation(id);
      setDetail(data);
      setDetailError('');
    } catch (err) {
      setDetailError(err.message || 'تعذر تحميل المحادثة');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId, false);
  }, [selectedId, loadDetail]);

  // Poll for updates every 3s — serverless-friendly (no websockets needed).
  useEffect(() => {
    const interval = setInterval(async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await loadConversations(true);
        if (selectedId) await loadDetail(selectedId, true);
      } finally {
        busyRef.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [loadConversations, loadDetail, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length]);

  async function handleSelect(conv) {
    setSelectedId(conv.id);
    if (conv.unread_count > 0) {
      try {
        await api.markRead(conv.id);
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)));
      } catch {
        // non-critical
      }
    }
  }

  async function withAction(fn) {
    setActionBusy(true);
    try {
      await fn();
      await loadConversations(true);
      if (selectedId) await loadDetail(selectedId, true);
    } catch (err) {
      setDetailError(err.message || 'فشل تنفيذ الإجراء');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSend(text) {
    const { message } = await api.reply(selectedId, text);
    setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
    await loadConversations(true);
  }

  const conversation = detail?.conversation;
  const countdown = detail?.serviceWindow?.expiresAt ? formatCountdown(detail.serviceWindow.expiresAt) : null;

  let composerDisabledReason = null;
  if (conversation?.status === 'closed') composerDisabledReason = 'المحادثة مغلقة — أعد فتحها لإرسال رد';
  else if (detail?.serviceWindow && !detail.serviceWindow.open) {
    composerDisabledReason =
      'انتهت نافذة الـ 24 ساعة لهذه المحادثة (TEMPLATE_REQUIRED). يلزم إرسال قالب رسالة معتمد من Meta لإعادة فتح المحادثة قبل إمكانية الرد الحر.';
  }

  return (
    <div className={`app-shell ${selectedId ? 'app-shell--conversation-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__header">
          <div>
            <div className="sidebar__title">صندوق دعم العملاء</div>
            <div className="sidebar__user">{user?.name} — {user?.role === 'admin' ? 'مدير' : 'موظف'}</div>
          </div>
          <div className="sidebar__actions">
            {user?.role === 'admin' && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/dashboard/users')}>
                المستخدمون
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
              خروج
            </button>
          </div>
        </div>

        <Filters active={tab} onChange={setTab} search={search} onSearchChange={setSearch} />

        <div className="conv-list">
          {listLoading && <div className="state-message">جارِ التحميل…</div>}
          {!listLoading && listError && <div className="state-message state-message--error">{listError}</div>}
          {!listLoading && !listError && conversations.length === 0 && (
            <div className="state-message">لا توجد محادثات مطابقة</div>
          )}
          {!listLoading &&
            conversations.map((c) => (
              <ConversationListItem key={c.id} conversation={c} active={c.id === selectedId} onClick={() => handleSelect(c)} />
            ))}
        </div>
      </aside>

      <main className="conversation-pane">
        {!selectedId && <div className="state-message state-message--center">اختر محادثة من القائمة لعرضها</div>}

        {selectedId && detailLoading && !detail && <div className="state-message state-message--center">جارِ تحميل المحادثة…</div>}

        {selectedId && detail && conversation && (
          <>
            <header className="conv-header">
              <button type="button" className="conv-header__back" onClick={() => setSelectedId(null)}>
                ← الرجوع
              </button>
              <div className="conv-header__info">
                <div className="conv-header__name">{conversation.customer_name || conversation.wa_id}</div>
                <div className="conv-header__meta">
                  <span>{conversation.wa_id}</span>
                  <span className={`tag tag--mode-${conversation.mode}`}>{MODE_LABEL[conversation.mode]}</span>
                  <span className={`tag tag--status-${conversation.status}`}>{STATUS_LABEL[conversation.status]}</span>
                  {conversation.assigned_to_name && <span className="tag">موظف: {conversation.assigned_to_name}</span>}
                  {countdown ? (
                    <span className="tag tag--window-open">النافذة نشطة — متبقي {countdown}</span>
                  ) : (
                    <span className="tag tag--window-closed">نافذة الرد الحر منتهية</span>
                  )}
                </div>
              </div>
              <div className="conv-header__actions">
                {!conversation.assigned_to ? (
                  <button className="btn btn--sm" disabled={actionBusy} onClick={() => withAction(() => api.claim(conversation.id))}>
                    استلام المحادثة
                  </button>
                ) : (
                  <button className="btn btn--sm btn--ghost" disabled={actionBusy} onClick={() => withAction(() => api.release(conversation.id))}>
                    تحرير المحادثة
                  </button>
                )}
                {conversation.mode === 'bot' && (
                  <button className="btn btn--sm" disabled={actionBusy} onClick={() => withAction(() => api.switchToHuman(conversation.id))}>
                    تحويل لموظف
                  </button>
                )}
                {conversation.mode === 'human' && (
                  <button className="btn btn--sm btn--ghost" disabled={actionBusy} onClick={() => setConfirmReturnToBot(true)}>
                    إعادة للبوت
                  </button>
                )}
                {conversation.status !== 'closed' ? (
                  <button className="btn btn--sm btn--danger" disabled={actionBusy} onClick={() => withAction(() => api.close(conversation.id))}>
                    إغلاق المحادثة
                  </button>
                ) : (
                  <button className="btn btn--sm" disabled={actionBusy} onClick={() => withAction(() => api.reopen(conversation.id))}>
                    إعادة الفتح
                  </button>
                )}
              </div>
            </header>

            {detailError && <div className="state-message state-message--error">{detailError}</div>}

            <div className="messages-pane">
              {detail.messages.length === 0 && <div className="state-message">لا توجد رسائل بعد</div>}
              {detail.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <Composer disabled={!!composerDisabledReason} disabledReason={composerDisabledReason} onSend={handleSend} />
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmReturnToBot}
        title="إعادة المحادثة للبوت"
        message="سيتم إيقاف تدخل الموظف واستئناف الردود الآلية لهذا العميل. هل تريد المتابعة؟"
        confirmLabel="نعم، أعد للبوت"
        onCancel={() => setConfirmReturnToBot(false)}
        onConfirm={() => {
          setConfirmReturnToBot(false);
          withAction(() => api.returnToBot(conversation.id));
        }}
      />
    </div>
  );
}
