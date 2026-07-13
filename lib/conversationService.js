const { sql, query, transaction } = require('./db');

const PREVIEW_MAX = 120;

function toPreview(text) {
  if (!text) return null;
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > PREVIEW_MAX ? clean.slice(0, PREVIEW_MAX - 1) + '…' : clean;
}

// ─── Conversations ────────────────────────────────────────────────────────────

async function getOrCreateConversation(waId, customerName) {
  const rows = await sql`
    INSERT INTO conversations (wa_id, customer_name)
    VALUES (${waId}, ${customerName || null})
    ON CONFLICT (wa_id) DO UPDATE
      SET customer_name = COALESCE(conversations.customer_name, EXCLUDED.customer_name),
          updated_at = now()
    RETURNING *
  `;
  return rows[0];
}

async function getConversationByWaId(waId) {
  const rows = await sql`SELECT * FROM conversations WHERE wa_id = ${waId}`;
  return rows[0] || null;
}

async function getConversationById(id) {
  const rows = await sql`SELECT * FROM conversations WHERE id = ${id}`;
  return rows[0] || null;
}

// Looks up by current wa_id, falling back to wa_id_history for a number
// that was since changed (defensive — normal traffic always uses the
// current wa_id after handlePhoneNumberChange runs).
async function getConversationByAnyWaId(waId) {
  const current = await getConversationByWaId(waId);
  if (current) return current;

  const rows = await sql`
    SELECT c.* FROM wa_id_history h
    JOIN conversations c ON c.id = h.conversation_id
    WHERE h.old_wa_id = ${waId}
    ORDER BY h.changed_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

// Handles Meta's "user_changed_number" system event. Renames the
// conversation's wa_id to the new number and records the change in
// wa_id_history. If a separate conversation already exists under the new
// number (e.g. the customer already messaged from it), the two are merged
// atomically so no message is lost or duplicated.
async function handlePhoneNumberChange({ oldWaId, newWaId }) {
  const primary = await getConversationByWaId(oldWaId);
  if (!primary) return { conversationId: null, merged: false };
  if (primary.wa_id === newWaId) return { conversationId: primary.id, merged: false };

  const conflicting = await getConversationByWaId(newWaId);

  if (conflicting && conflicting.id !== primary.id) {
    await transaction([
      sql`UPDATE messages SET conversation_id = ${primary.id} WHERE conversation_id = ${conflicting.id}`,
      sql`INSERT INTO wa_id_history (conversation_id, old_wa_id, new_wa_id) VALUES (${primary.id}, ${oldWaId}, ${newWaId})`,
      sql`DELETE FROM conversations WHERE id = ${conflicting.id}`,
      sql`UPDATE conversations SET wa_id = ${newWaId}, customer_name = COALESCE(conversations.customer_name, ${conflicting.customer_name}), updated_at = now() WHERE id = ${primary.id}`,
    ]);
    return { conversationId: primary.id, merged: true };
  }

  await transaction([
    sql`INSERT INTO wa_id_history (conversation_id, old_wa_id, new_wa_id) VALUES (${primary.id}, ${oldWaId}, ${newWaId})`,
    sql`UPDATE conversations SET wa_id = ${newWaId}, updated_at = now() WHERE id = ${primary.id}`,
  ]);
  return { conversationId: primary.id, merged: false };
}

async function touchConversationOnInbound(conversationId, { text, at }) {
  const rows = await sql`
    UPDATE conversations
    SET last_message_preview = ${toPreview(text)},
        last_message_at = ${at},
        last_customer_message_at = ${at},
        unread_count = unread_count + 1,
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

// System events (e.g. number changed) bump the conversation preview so it
// resurfaces in the list, but must NOT count as unread and must NOT open
// the 24-hour customer-service window.
async function touchConversationOnSystemEvent(conversationId, { preview }) {
  const rows = await sql`
    UPDATE conversations
    SET last_message_preview = ${toPreview(preview)},
        last_message_at = now(),
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

async function touchConversationOnOutbound(conversationId, { text, resetUnread }) {
  const rows = resetUnread
    ? await sql`
        UPDATE conversations
        SET last_message_preview = ${toPreview(text)},
            last_message_at = now(),
            unread_count = 0,
            updated_at = now()
        WHERE id = ${conversationId}
        RETURNING *
      `
    : await sql`
        UPDATE conversations
        SET last_message_preview = ${toPreview(text)},
            last_message_at = now(),
            updated_at = now()
        WHERE id = ${conversationId}
        RETURNING *
      `;
  return rows[0];
}

// Sets mode='human'/status='pending' once. Returns { conversation, alreadyHandedOff }
// so callers only send the human-agent acknowledgement message the first time.
async function requestHandoff(conversationId) {
  const current = await getConversationById(conversationId);
  if (!current) return { conversation: null, alreadyHandedOff: false };
  if (current.mode === 'human') return { conversation: current, alreadyHandedOff: true };

  const rows = await sql`
    UPDATE conversations
    SET mode = 'human',
        status = 'pending',
        handoff_requested_at = now(),
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return { conversation: rows[0], alreadyHandedOff: false };
}

// Used when an agent starts a brand-new (or dormant) conversation via an
// approved template: the conversation is handed to that agent directly,
// rather than waiting on a customer-initiated handoff.
async function assignHumanForAgentInitiated(conversationId, adminUserId) {
  const rows = await sql`
    UPDATE conversations
    SET mode = 'human',
        status = 'pending',
        assigned_to = ${adminUserId},
        handoff_requested_at = COALESCE(handoff_requested_at, now()),
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

async function returnToBot(conversationId) {
  const rows = await sql`
    UPDATE conversations
    SET mode = 'bot',
        status = 'open',
        assigned_to = NULL,
        handoff_requested_at = NULL,
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

async function claimConversation(conversationId, adminUserId) {
  const rows = await sql`
    UPDATE conversations
    SET assigned_to = ${adminUserId},
        status = 'open',
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

async function releaseConversation(conversationId) {
  const rows = await sql`
    UPDATE conversations
    SET assigned_to = NULL,
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

async function setConversationStatus(conversationId, status) {
  const rows = await sql`
    UPDATE conversations
    SET status = ${status},
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

async function markConversationRead(conversationId) {
  const rows = await sql`
    UPDATE conversations
    SET unread_count = 0,
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *
  `;
  return rows[0];
}

async function listConversations({ page = 1, pageSize = 30, search, mode, status, unreadOnly, assignedTo } = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (search) {
    conditions.push(`(wa_id ILIKE $${i} OR customer_name ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (mode) {
    conditions.push(`mode = $${i}`);
    params.push(mode);
    i++;
  }
  if (status) {
    conditions.push(`status = $${i}`);
    params.push(status);
    i++;
  }
  if (unreadOnly) {
    conditions.push(`unread_count > 0`);
  }
  if (assignedTo) {
    conditions.push(`assigned_to = $${i}`);
    params.push(assignedTo);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(pageSize) || 30, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const dataSql = `
    SELECT c.*, u.name AS assigned_to_name
    FROM conversations c
    LEFT JOIN admin_users u ON u.id = c.assigned_to
    ${where}
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT $${i} OFFSET $${i + 1}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM conversations c ${where}`;

  const [rows, countRows] = await Promise.all([
    query(dataSql, [...params, limit, offset]),
    query(countSql, params),
  ]);

  return { rows, total: countRows[0]?.total || 0, page: Math.max(Number(page) || 1, 1), pageSize: limit };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

// Returns the inserted message row, or null if wa_message_id was a duplicate.
// Accepts every rich-media field; callers only pass what's relevant to the
// message type (all extras default to null/absent).
async function recordInboundMessage({
  conversationId,
  waMessageId,
  messageType,
  text,
  mediaId,
  rawPayload,
  senderType,
  caption,
  mimeType,
  filename,
  fileSize,
  sha256,
  durationSeconds,
  latitude,
  longitude,
  locationName,
  locationAddress,
  contactsData,
  reactionEmoji,
  reactedMessageWaId,
  contextMessageWaId,
  interactiveData,
  systemData,
  mediaStatus,
}) {
  const rows = await sql`
    INSERT INTO messages (
      conversation_id, wa_message_id, direction, sender_type, message_type, text, media_id, status, raw_payload,
      caption, mime_type, filename, file_size, sha256, duration_seconds,
      latitude, longitude, location_name, location_address, contacts_data,
      reaction_emoji, reacted_message_wa_id, context_message_wa_id, interactive_data, system_data, media_status
    )
    VALUES (
      ${conversationId}, ${waMessageId}, 'inbound', ${senderType || 'customer'}, ${messageType}, ${text || null}, ${mediaId || null}, 'received',
      ${rawPayload ? JSON.stringify(rawPayload) : null},
      ${caption || null}, ${mimeType || null}, ${filename || null}, ${fileSize || null}, ${sha256 || null}, ${durationSeconds || null},
      ${latitude ?? null}, ${longitude ?? null}, ${locationName || null}, ${locationAddress || null},
      ${contactsData ? JSON.stringify(contactsData) : null},
      ${reactionEmoji ?? null}, ${reactedMessageWaId || null}, ${contextMessageWaId || null},
      ${interactiveData ? JSON.stringify(interactiveData) : null}, ${systemData ? JSON.stringify(systemData) : null}, ${mediaStatus || null}
    )
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING *
  `;
  return rows[0] || null;
}

async function recordOutboundMessage({
  conversationId,
  waMessageId,
  senderType,
  text,
  sentBy,
  status,
  messageType,
  templateName,
  templateLanguage,
  rawPayload,
  caption,
  mimeType,
  filename,
  fileSize,
  sha256,
  storageKey,
  storageUrl,
  durationSeconds,
  latitude,
  longitude,
  locationName,
  locationAddress,
  contactsData,
  reactionEmoji,
  reactedMessageWaId,
  contextMessageWaId,
  mediaStatus,
}) {
  const rows = await sql`
    INSERT INTO messages (
      conversation_id, wa_message_id, direction, sender_type, message_type, text, status, sent_by,
      template_name, template_language, raw_payload,
      caption, mime_type, filename, file_size, sha256, storage_key, storage_url, duration_seconds,
      latitude, longitude, location_name, location_address, contacts_data,
      reaction_emoji, reacted_message_wa_id, context_message_wa_id, media_status
    )
    VALUES (
      ${conversationId}, ${waMessageId || null}, 'outbound', ${senderType}, ${messageType || 'text'}, ${text || null},
      ${status || 'sent'}, ${sentBy || null}, ${templateName || null}, ${templateLanguage || null},
      ${rawPayload ? JSON.stringify(rawPayload) : null},
      ${caption || null}, ${mimeType || null}, ${filename || null}, ${fileSize || null}, ${sha256 || null},
      ${storageKey || null}, ${storageUrl || null}, ${durationSeconds || null},
      ${latitude ?? null}, ${longitude ?? null}, ${locationName || null}, ${locationAddress || null},
      ${contactsData ? JSON.stringify(contactsData) : null},
      ${reactionEmoji ?? null}, ${reactedMessageWaId || null}, ${contextMessageWaId || null}, ${mediaStatus || null}
    )
    RETURNING *
  `;
  return rows[0];
}

async function updateMessageStatusByWaId(waMessageId, status) {
  const rows = await sql`
    UPDATE messages SET status = ${status}
    WHERE wa_message_id = ${waMessageId}
    RETURNING *
  `;
  return rows[0] || null;
}

async function getMessageById(id) {
  const rows = await sql`SELECT * FROM messages WHERE id = ${id}`;
  return rows[0] || null;
}

async function getMessageByWaMessageId(waMessageId) {
  const rows = await sql`SELECT * FROM messages WHERE wa_message_id = ${waMessageId}`;
  return rows[0] || null;
}

// Called after a lazy media download/upload completes (or fails) so the
// authenticated media endpoint can serve from storage next time instead of
// re-fetching from Meta.
async function updateMessageMediaStorage(id, { storageKey, storageUrl, mediaStatus, mediaError, fileSize, mimeType, sha256, thumbnailStorageKey }) {
  const rows = await sql`
    UPDATE messages
    SET storage_key = COALESCE(${storageKey || null}, storage_key),
        storage_url = COALESCE(${storageUrl || null}, storage_url),
        media_status = ${mediaStatus || null},
        media_error = ${mediaError || null},
        file_size = COALESCE(${fileSize || null}, file_size),
        mime_type = COALESCE(${mimeType || null}, mime_type),
        sha256 = COALESCE(${sha256 || null}, sha256),
        thumbnail_storage_key = COALESCE(${thumbnailStorageKey || null}, thumbnail_storage_key)
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

// sent_by_name lets the dashboard show exactly which employee sent each
// agent message (accountability), not just the generic "agent" role label.
async function listMessages(conversationId, { limit = 200 } = {}) {
  return sql`
    SELECT m.*, u.name AS sent_by_name
    FROM messages m
    LEFT JOIN admin_users u ON u.id = m.sent_by
    WHERE m.conversation_id = ${conversationId}
    ORDER BY m.created_at ASC
    LIMIT ${limit}
  `;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

async function logAudit({ userId, conversationId, action, metadata }) {
  try {
    await sql`
      INSERT INTO audit_logs (user_id, conversation_id, action, metadata)
      VALUES (${userId || null}, ${conversationId || null}, ${action}, ${metadata ? JSON.stringify(metadata) : null})
    `;
  } catch (err) {
    console.error('[audit] failed to log action:', action, err.message);
  }
}

// Per-conversation accountability timeline (who claimed/released/closed/
// reopened/transferred/returned-to-bot, and when). Available to any
// authenticated admin/agent that can already view the conversation.
async function listConversationActivity(conversationId, { limit = 100 } = {}) {
  return sql`
    SELECT a.*, u.name AS actor_name, u.email AS actor_email
    FROM audit_logs a
    LEFT JOIN admin_users u ON u.id = a.user_id
    WHERE a.conversation_id = ${conversationId}
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `;
}

// Global cross-employee activity feed — admin-only (enforced at the API
// layer via withAuth roles, not here).
async function listAllActivity({ page = 1, pageSize = 50, userId, action } = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (userId) {
    conditions.push(`a.user_id = $${i}`);
    params.push(userId);
    i++;
  }
  if (action) {
    conditions.push(`a.action = $${i}`);
    params.push(action);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const dataSql = `
    SELECT a.*, u.name AS actor_name, u.email AS actor_email,
           c.wa_id AS conversation_wa_id, c.customer_name AS conversation_customer_name
    FROM audit_logs a
    LEFT JOIN admin_users u ON u.id = a.user_id
    LEFT JOIN conversations c ON c.id = a.conversation_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs a ${where}`;

  const [rows, countRows] = await Promise.all([
    query(dataSql, [...params, limit, offset]),
    query(countSql, params),
  ]);

  return { rows, total: countRows[0]?.total || 0, page: Math.max(Number(page) || 1, 1), pageSize: limit };
}

module.exports = {
  getOrCreateConversation,
  getConversationByWaId,
  getConversationByAnyWaId,
  getConversationById,
  handlePhoneNumberChange,
  touchConversationOnInbound,
  touchConversationOnSystemEvent,
  touchConversationOnOutbound,
  requestHandoff,
  assignHumanForAgentInitiated,
  returnToBot,
  claimConversation,
  releaseConversation,
  setConversationStatus,
  markConversationRead,
  listConversations,
  recordInboundMessage,
  recordOutboundMessage,
  updateMessageStatusByWaId,
  getMessageById,
  getMessageByWaMessageId,
  updateMessageMediaStorage,
  listMessages,
  logAudit,
  listConversationActivity,
  listAllActivity,
};
