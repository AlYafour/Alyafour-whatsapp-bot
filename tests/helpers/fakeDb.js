// In-memory fake for lib/db.js's { sql, query, transaction } surface, built
// to recognize the exact query shapes used by lib/conversationService.js.
// Throws on anything unrecognized so a schema/query drift fails loudly in
// tests instead of silently returning wrong (empty) results.
const crypto = require('crypto');
const newId = () => crypto.randomUUID();

// Real Neon/Postgres JSONB columns round-trip as parsed objects even though
// the app writes them via JSON.stringify() — mirror that here.
function jsonParseMaybe(value) {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function createFakeDb() {
  const state = { conversations: [], messages: [], waIdHistory: [], auditLogs: [], users: {} };

  function findConvByWaId(waId) {
    return state.conversations.find((c) => c.wa_id === waId) || null;
  }
  function findConvById(id) {
    return state.conversations.find((c) => c.id === id) || null;
  }
  function findMsgById(id) {
    return state.messages.find((m) => m.id === id) || null;
  }
  function findMsgByWaMessageId(waMessageId) {
    return state.messages.find((m) => m.wa_message_id === waMessageId) || null;
  }

  function sql(strings, ...values) {
    const text = strings.join('?');

    // ── admin_users (used by lib/authMiddleware.js) ─────────────────────────
    if (text.includes('FROM admin_users')) {
      const [id] = values;
      const user = state.users[id];
      return Promise.resolve(user ? [user] : []);
    }

    // ── conversations: create / lookup ─────────────────────────────────────
    if (text.includes('INSERT INTO conversations') && text.includes('ON CONFLICT (wa_id)')) {
      const [waId, customerName] = values;
      let conv = findConvByWaId(waId);
      if (!conv) {
        conv = {
          id: newId(), wa_id: waId, customer_name: customerName || null, mode: 'bot', status: 'open',
          department: null, assigned_to: null, unread_count: 0, last_message_preview: null,
          last_message_at: null, last_customer_message_at: null, handoff_requested_at: null,
        };
        state.conversations.push(conv);
      } else if (!conv.customer_name && customerName) {
        conv.customer_name = customerName;
      }
      return Promise.resolve([conv]);
    }

    if (text.includes('SELECT * FROM conversations WHERE wa_id')) {
      const [waId] = values;
      const conv = findConvByWaId(waId);
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('wa_id_history') && text.includes('JOIN conversations')) {
      const [waId] = values;
      const entries = state.waIdHistory.filter((h) => h.old_wa_id === waId).sort((a, b) => b.changed_at - a.changed_at);
      if (!entries.length) return Promise.resolve([]);
      const conv = findConvById(entries[0].conversation_id);
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('SELECT * FROM conversations WHERE id')) {
      const [id] = values;
      const conv = findConvById(id);
      return Promise.resolve(conv ? [conv] : []);
    }

    // ── phone-number-change transaction steps ──────────────────────────────
    if (text.includes('UPDATE messages SET conversation_id')) {
      const [primaryId, conflictingId] = values;
      state.messages.filter((m) => m.conversation_id === conflictingId).forEach((m) => (m.conversation_id = primaryId));
      return Promise.resolve([]);
    }

    if (text.includes('INSERT INTO wa_id_history')) {
      const [conversationId, oldWaId, newWaId] = values;
      state.waIdHistory.push({ id: newId(), conversation_id: conversationId, old_wa_id: oldWaId, new_wa_id: newWaId, changed_at: state.waIdHistory.length });
      return Promise.resolve([]);
    }

    if (text.includes('DELETE FROM conversations')) {
      const [id] = values;
      state.conversations = state.conversations.filter((c) => c.id !== id);
      return Promise.resolve([]);
    }

    if (text.includes('UPDATE conversations') && text.includes('SET wa_id')) {
      const merge = text.includes('customer_name = COALESCE');
      if (merge) {
        const [newWaId, conflictingCustomerName, primaryId] = values;
        const conv = findConvById(primaryId);
        if (conv) {
          conv.wa_id = newWaId;
          conv.customer_name = conv.customer_name || conflictingCustomerName || null;
        }
        return Promise.resolve(conv ? [conv] : []);
      }
      const [newWaId, primaryId] = values;
      const conv = findConvById(primaryId);
      if (conv) conv.wa_id = newWaId;
      return Promise.resolve(conv ? [conv] : []);
    }

    // ── conversation touch/state mutations ──────────────────────────────────
    if (text.includes('last_customer_message_at') && text.includes('unread_count = unread_count + 1')) {
      const [preview, at, , conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) {
        conv.last_message_preview = preview;
        conv.last_message_at = at;
        conv.last_customer_message_at = at;
        conv.unread_count += 1;
      }
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('unread_count = 0') && text.includes('last_message_preview')) {
      const [preview, conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) {
        conv.last_message_preview = preview;
        conv.unread_count = 0;
      }
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('last_message_preview') && !text.includes('unread_count')) {
      // Shared shape: touchConversationOnSystemEvent AND
      // touchConversationOnOutbound(resetUnread: false) — identical SQL.
      const [preview, conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) conv.last_message_preview = preview;
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes("mode = 'human'") && text.includes('assigned_to')) {
      const [adminUserId, conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) {
        conv.mode = 'human';
        conv.status = 'pending';
        conv.assigned_to = adminUserId;
        conv.handoff_requested_at = conv.handoff_requested_at || new Date();
      }
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes("mode = 'human'")) {
      const [conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) {
        conv.mode = 'human';
        conv.status = 'pending';
        conv.handoff_requested_at = new Date();
      }
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes("mode = 'bot'")) {
      const [conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) {
        conv.mode = 'bot';
        conv.status = 'open';
        conv.assigned_to = null;
        conv.handoff_requested_at = null;
      }
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('SET assigned_to = NULL')) {
      const [conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) conv.assigned_to = null;
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('SET assigned_to')) {
      const [adminUserId, conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) {
        conv.assigned_to = adminUserId;
        conv.status = 'open';
      }
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('SET status =')) {
      const [status, conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) conv.status = status;
      return Promise.resolve(conv ? [conv] : []);
    }

    if (text.includes('SET unread_count = 0')) {
      const [conversationId] = values;
      const conv = findConvById(conversationId);
      if (conv) conv.unread_count = 0;
      return Promise.resolve(conv ? [conv] : []);
    }

    // ── messages ─────────────────────────────────────────────────────────────
    if (text.includes('INSERT INTO messages') && text.includes("'inbound'")) {
      const [
        conversationId, waMessageId, senderType, messageType, msgText, mediaId, rawPayload,
        caption, mimeType, filename, fileSize, sha256, durationSeconds,
        latitude, longitude, locationName, locationAddress, contactsData,
        reactionEmoji, reactedMessageWaId, contextMessageWaId, interactiveData, systemData, mediaStatus,
      ] = values;

      if (waMessageId && findMsgByWaMessageId(waMessageId)) return Promise.resolve([]); // ON CONFLICT DO NOTHING

      const msg = {
        id: newId(), conversation_id: conversationId, wa_message_id: waMessageId, direction: 'inbound',
        sender_type: senderType, message_type: messageType, text: msgText, media_id: mediaId, status: 'received',
        raw_payload: jsonParseMaybe(rawPayload), caption, mime_type: mimeType, filename, file_size: fileSize, sha256, duration_seconds: durationSeconds,
        latitude, longitude, location_name: locationName, location_address: locationAddress, contacts_data: jsonParseMaybe(contactsData),
        reaction_emoji: reactionEmoji, reacted_message_wa_id: reactedMessageWaId, context_message_wa_id: contextMessageWaId,
        interactive_data: jsonParseMaybe(interactiveData), system_data: jsonParseMaybe(systemData), media_status: mediaStatus,
        created_at: new Date(),
      };
      state.messages.push(msg);
      return Promise.resolve([msg]);
    }

    if (text.includes('INSERT INTO messages') && text.includes("'outbound'")) {
      const [
        conversationId, waMessageId, senderType, messageType, msgText, status, sentBy, templateName, templateLanguage,
        rawPayload, caption, mimeType, filename, fileSize, sha256, storageKey, storageUrl, durationSeconds,
        latitude, longitude, locationName, locationAddress, contactsData, reactionEmoji, reactedMessageWaId, contextMessageWaId, mediaStatus,
      ] = values;

      const msg = {
        id: newId(), conversation_id: conversationId, wa_message_id: waMessageId, direction: 'outbound',
        sender_type: senderType, message_type: messageType, text: msgText, status, sent_by: sentBy,
        template_name: templateName, template_language: templateLanguage, raw_payload: jsonParseMaybe(rawPayload),
        caption, mime_type: mimeType, filename, file_size: fileSize, sha256, storage_key: storageKey, storage_url: storageUrl,
        duration_seconds: durationSeconds, latitude, longitude, location_name: locationName, location_address: locationAddress,
        contacts_data: jsonParseMaybe(contactsData), reaction_emoji: reactionEmoji, reacted_message_wa_id: reactedMessageWaId,
        context_message_wa_id: contextMessageWaId, media_status: mediaStatus,
        created_at: new Date(),
      };
      state.messages.push(msg);
      return Promise.resolve([msg]);
    }

    if (text.includes('UPDATE messages SET status')) {
      const [status, waMessageId] = values;
      const msg = findMsgByWaMessageId(waMessageId);
      if (msg) msg.status = status;
      return Promise.resolve(msg ? [msg] : []);
    }

    if (text.includes('UPDATE messages') && text.includes('storage_key')) {
      const [storageKey, storageUrl, mediaStatus, mediaError, fileSize, mimeType, sha256, thumbnailStorageKey, id] = values;
      const msg = findMsgById(id);
      if (msg) {
        msg.storage_key = storageKey || msg.storage_key;
        msg.storage_url = storageUrl || msg.storage_url;
        msg.media_status = mediaStatus;
        msg.media_error = mediaError;
        msg.file_size = fileSize || msg.file_size;
        msg.mime_type = mimeType || msg.mime_type;
        msg.sha256 = sha256 || msg.sha256;
        msg.thumbnail_storage_key = thumbnailStorageKey || msg.thumbnail_storage_key;
      }
      return Promise.resolve(msg ? [msg] : []);
    }

    if (text.includes('SELECT * FROM messages WHERE id')) {
      const [id] = values;
      const msg = findMsgById(id);
      return Promise.resolve(msg ? [msg] : []);
    }

    if (text.includes('SELECT * FROM messages WHERE wa_message_id')) {
      const [waMessageId] = values;
      const msg = findMsgByWaMessageId(waMessageId);
      return Promise.resolve(msg ? [msg] : []);
    }

    if (text.includes('SELECT * FROM messages WHERE conversation_id')) {
      const [conversationId] = values;
      return Promise.resolve(
        state.messages.filter((m) => m.conversation_id === conversationId).sort((a, b) => a.created_at - b.created_at)
      );
    }

    if (text.includes('INSERT INTO audit_logs')) {
      const [userId, conversationId, action, metadata] = values;
      state.auditLogs.push({ id: newId(), user_id: userId, conversation_id: conversationId, action, metadata: jsonParseMaybe(metadata) });
      return Promise.resolve([]);
    }

    throw new Error('fakeDb: unmatched query: ' + text.slice(0, 120));
  }

  async function query() {
    return [];
  }

  async function transaction(queries) {
    return Promise.all(queries);
  }

  return { sql, query, transaction, state };
}

module.exports = { createFakeDb };
