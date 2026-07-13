const { sql, query } = require('./db');

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
async function recordInboundMessage({ conversationId, waMessageId, messageType, text, mediaId, rawPayload }) {
  const rows = await sql`
    INSERT INTO messages (conversation_id, wa_message_id, direction, sender_type, message_type, text, media_id, status, raw_payload)
    VALUES (${conversationId}, ${waMessageId}, 'inbound', 'customer', ${messageType}, ${text || null}, ${mediaId || null}, 'received', ${rawPayload ? JSON.stringify(rawPayload) : null})
    ON CONFLICT (wa_message_id) DO NOTHING
    RETURNING *
  `;
  return rows[0] || null;
}

async function recordOutboundMessage({ conversationId, waMessageId, senderType, text, sentBy, status }) {
  const rows = await sql`
    INSERT INTO messages (conversation_id, wa_message_id, direction, sender_type, message_type, text, status, sent_by)
    VALUES (${conversationId}, ${waMessageId || null}, 'outbound', ${senderType}, 'text', ${text || null}, ${status || 'sent'}, ${sentBy || null})
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

async function listMessages(conversationId, { limit = 200 } = {}) {
  return sql`
    SELECT * FROM messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
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

module.exports = {
  getOrCreateConversation,
  getConversationByWaId,
  getConversationById,
  touchConversationOnInbound,
  touchConversationOnOutbound,
  requestHandoff,
  returnToBot,
  claimConversation,
  releaseConversation,
  setConversationStatus,
  markConversationRead,
  listConversations,
  recordInboundMessage,
  recordOutboundMessage,
  updateMessageStatusByWaId,
  listMessages,
  logAudit,
};
