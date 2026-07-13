const { getSession, saveSession, defaultSession, isSessionExpired } = require('../lib/sessionManager');
const { markAsRead } = require('../lib/whatsappApi');
const { sendAndLogMessage } = require('../lib/messagingService');
const { getAIResponse, needsHandoff, needsMenu } = require('../lib/aiHandler');
const { isBusinessHours } = require('../lib/businessHours');
const { DEPARTMENTS, buildContactCard } = require('../lib/departments');
const MENUS = require('../lib/menu');
const {
  getOrCreateConversation,
  getConversationByWaId,
  handlePhoneNumberChange,
  recordInboundMessage,
  touchConversationOnInbound,
  touchConversationOnSystemEvent,
  requestHandoff,
  updateMessageStatusByWaId,
  logAudit,
} = require('../lib/conversationService');

// ─── Webhook verification (GET) ───────────────────────────────────────────────
function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Forbidden' });
}

// ─── Detect language from text ────────────────────────────────────────────────
function detectLanguage(text) {
  return /[؀-ۿ]/.test(text) ? 'ar' : 'en';
}

const MEDIA_TYPES = ['image', 'video', 'document'];

// ─── Classify an inbound Meta message into our storage shape ──────────────────
// Returns a superset shape; fields irrelevant to a given type are left null.
function classifyMessage(message) {
  const type = message.type;
  const contextMessageWaId = message.context?.id || null;
  const base = { contextMessageWaId };

  if (type === 'text') {
    return { ...base, messageType: 'text', text: message.text?.body?.trim() || null, mediaId: null };
  }

  if (MEDIA_TYPES.includes(type)) {
    const media = message[type] || {};
    return {
      ...base,
      messageType: type,
      mediaId: media.id || null,
      mimeType: media.mime_type || null,
      caption: media.caption || null,
      filename: media.filename || null,
      mediaStatus: 'pending',
    };
  }

  if (type === 'audio') {
    const media = message.audio || {};
    return {
      ...base,
      messageType: media.voice ? 'voice' : 'audio',
      mediaId: media.id || null,
      mimeType: media.mime_type || null,
      mediaStatus: 'pending',
    };
  }

  if (type === 'sticker') {
    const media = message.sticker || {};
    return {
      ...base,
      messageType: 'sticker',
      mediaId: media.id || null,
      mimeType: media.mime_type || null,
      mediaStatus: 'pending',
    };
  }

  if (type === 'location') {
    const loc = message.location || {};
    return {
      ...base,
      messageType: 'location',
      text: loc.name || loc.address || null,
      latitude: loc.latitude ?? null,
      longitude: loc.longitude ?? null,
      locationName: loc.name || null,
      locationAddress: loc.address || null,
    };
  }

  if (type === 'contacts') {
    const contacts = message.contacts || [];
    const firstName = contacts[0]?.name?.formatted_name || null;
    return {
      ...base,
      messageType: 'contacts',
      text: firstName,
      contactsData: contacts,
    };
  }

  if (type === 'reaction') {
    const reaction = message.reaction || {};
    return {
      ...base,
      messageType: 'reaction',
      reactionEmoji: reaction.emoji || '',
      reactedMessageWaId: reaction.message_id || null,
    };
  }

  if (type === 'interactive') {
    const interactive = message.interactive || {};
    const reply = interactive[interactive.type] || {};
    return {
      ...base,
      messageType: 'interactive',
      text: reply.title || null,
      interactiveData: interactive,
    };
  }

  if (type === 'unsupported') {
    return { ...base, messageType: 'unsupported' };
  }

  return { ...base, messageType: 'unknown' };
}

// ─── Handle department selection ──────────────────────────────────────────────
async function handleDeptSelection(from, key, session, conversationId) {
  const lang = session.language;
  const menu = MENUS[lang];
  const deptName = menu.departments[key];

  if (!deptName) return false; // not a department key

  // Option 9 → human agent handoff
  if (key === '9') {
    const { alreadyHandedOff } = await requestHandoff(conversationId);
    if (!alreadyHandedOff) {
      await sendAndLogMessage({ conversationId, waId: from, text: menu.humanAgent, senderType: 'bot' });
    }
    session.step = 'chat';
    session.department = null;
    session.history = [];
    return true;
  }

  // Option 8 → working hours
  if (key === '8') {
    await sendAndLogMessage({ conversationId, waId: from, text: menu.workingHoursInfo, senderType: 'bot' });
    session.department = deptName;
    return true;
  }

  session.department = deptName;
  session.departmentKey = key;

  const contactCard = buildContactCard(DEPARTMENTS[key], lang);
  await sendAndLogMessage({ conversationId, waId: from, text: menu.deptIntro(deptName), senderType: 'bot' });
  if (contactCard) await sendAndLogMessage({ conversationId, waId: from, text: contactCard, senderType: 'bot' });
  return true;
}

// ─── System events (e.g. customer changed WhatsApp number) ────────────────────
// Never triggers the bot, never counts as unread, never opens the 24h window.
async function handleSystemMessage(message, waMessageId) {
  const system = message.system || {};

  if (system.type !== 'user_changed_number') {
    console.log('[WH] unhandled system event type:', system.type);
    return;
  }

  const oldWaId = message.from || null;
  const newWaId = system.wa_id || null;
  if (!oldWaId || !newWaId) return;

  const conversation = await getConversationByWaId(oldWaId);
  if (!conversation) return; // no prior conversation — nothing meaningful to record

  // Idempotent on wa_message_id: a duplicate delivery must not re-run the
  // rename/merge below.
  const saved = await recordInboundMessage({
    conversationId: conversation.id,
    waMessageId,
    messageType: 'system',
    senderType: 'system',
    systemData: { type: 'user_changed_number', oldWaId, newWaId },
    rawPayload: message,
  });
  if (!saved) return;

  const { merged } = await handlePhoneNumberChange({ oldWaId, newWaId });

  await touchConversationOnSystemEvent(conversation.id, { preview: `📱 ${oldWaId} → ${newWaId}` });
  await logAudit({
    conversationId: conversation.id,
    action: 'phone_number_changed',
    metadata: { oldWaId, newWaId, merged },
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method === 'GET') return handleVerification(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;

    // ── Delivery/read status callbacks for our own outbound messages ─────────
    const statuses = value?.statuses;
    if (statuses?.length) {
      for (const s of statuses) {
        updateMessageStatusByWaId(s.id, s.status).catch((e) =>
          console.error('[WH] status update error:', e.message)
        );
      }
    }

    const message = value?.messages?.[0];
    if (!message) return res.status(200).json({ status: 'ok' });

    const waMessageId = message.id;

    // ── System events never touch bot/unread/24h-window logic ────────────────
    if (message.type === 'system') {
      await handleSystemMessage(message, waMessageId);
      return res.status(200).json({ status: 'ok' });
    }

    const from = message.from;
    const {
      messageType,
      text,
      mediaId,
      mimeType,
      caption,
      filename,
      mediaStatus,
      latitude,
      longitude,
      locationName,
      locationAddress,
      contactsData,
      reactionEmoji,
      reactedMessageWaId,
      interactiveData,
      contextMessageWaId,
    } = classifyMessage(message);
    const customerName = value?.contacts?.[0]?.profile?.name || null;

    console.log('[WH] from:', from, '| type:', messageType);

    markAsRead(waMessageId).catch(() => {});

    // ── Persist to Neon before any bot processing (idempotent on wa_message_id) ─
    const conversation = await getOrCreateConversation(from, customerName);
    const saved = await recordInboundMessage({
      conversationId: conversation.id,
      waMessageId,
      messageType,
      text,
      mediaId,
      mimeType,
      caption,
      filename,
      mediaStatus,
      latitude,
      longitude,
      locationName,
      locationAddress,
      contactsData,
      reactionEmoji,
      reactedMessageWaId,
      interactiveData,
      contextMessageWaId,
      rawPayload: message,
    });

    if (!saved) {
      // Duplicate webhook delivery — already stored, do not reprocess.
      return res.status(200).json({ status: 'ok' });
    }

    const preview = text || caption || `[${messageType}]`;
    await touchConversationOnInbound(conversation.id, { text: preview, at: new Date() });

    // ── Human mode: an agent owns this conversation, bot stays silent ────────
    if (conversation.mode === 'human') {
      return res.status(200).json({ status: 'ok' });
    }

    // Non-text messages are stored above but don't drive the menu/AI flow.
    if (messageType !== 'text' || !text) {
      return res.status(200).json({ status: 'ok' });
    }

    let session = await getSession(from);

    // ── Fresh start or inactivity timeout ────────────────────────────────────
    const isNew = session.step === 'language_selection' && !session.language;
    const timedOut = session.step !== 'language_selection' && isSessionExpired(session);

    if (isNew || timedOut) {
      const lang = detectLanguage(text);
      session = defaultSession();
      session.language = lang;
      session.step = 'chat';
      session.lastActivity = Date.now();

      if (!isBusinessHours()) {
        await sendAndLogMessage({ conversationId: conversation.id, waId: from, text: MENUS[lang].outOfHours, senderType: 'bot' });
        await saveSession(from, session);
        return res.status(200).json({ status: 'ok' });
      }

      await sendAndLogMessage({ conversationId: conversation.id, waId: from, text: MENUS[lang].welcome, senderType: 'bot' });
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    session.lastActivity = Date.now();

    // ── Auto-detect language if not set ─────────────────────────────────────
    if (!session.language) session.language = detectLanguage(text);
    const lang = session.language;
    const menu = MENUS[lang];

    // ── Keyword: show menu ───────────────────────────────────────────────────
    if (needsMenu(text, lang)) {
      await sendAndLogMessage({ conversationId: conversation.id, waId: from, text: menu.menu, senderType: 'bot' });
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    // ── Keyword: human agent ─────────────────────────────────────────────────
    if (needsHandoff(text, lang)) {
      const { alreadyHandedOff } = await requestHandoff(conversation.id);
      if (!alreadyHandedOff) {
        await sendAndLogMessage({ conversationId: conversation.id, waId: from, text: menu.humanAgent, senderType: 'bot' });
      }
      session.department = null;
      session.history = [];
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    // ── Number 1–9: department selection ─────────────────────────────────────
    if (/^[1-9]$/.test(text.trim())) {
      const handled = await handleDeptSelection(from, text.trim(), session, conversation.id);
      if (handled) {
        await saveSession(from, session);
        return res.status(200).json({ status: 'ok' });
      }
    }

    // ── Out-of-hours check ───────────────────────────────────────────────────
    if (!isBusinessHours()) {
      await sendAndLogMessage({ conversationId: conversation.id, waId: from, text: menu.outOfHours, senderType: 'bot' });
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    // ── AI answers the question ──────────────────────────────────────────────
    try {
      const aiReply = await getAIResponse(
        text,
        session.history,
        session.department || 'General Inquiry',
        lang
      );

      session.history.push(
        { role: 'user', content: text },
        { role: 'assistant', content: aiReply }
      );
      if (session.history.length > 16) session.history = session.history.slice(-16);

      await sendAndLogMessage({ conversationId: conversation.id, waId: from, text: aiReply, senderType: 'bot' });
    } catch (err) {
      console.error('[AI error]', err.message);
      await sendAndLogMessage({ conversationId: conversation.id, waId: from, text: menu.humanAgent, senderType: 'bot' });
      session.history = [];
    }

    await saveSession(from, session);
  } catch (err) {
    console.error('[WH error]', err.message);
  }

  return res.status(200).json({ status: 'ok' });
};
