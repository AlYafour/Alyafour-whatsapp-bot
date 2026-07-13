const { sendMessage } = require('./whatsappApi');
const { recordOutboundMessage, touchConversationOnOutbound } = require('./conversationService');

// Sends a WhatsApp message and logs it to Neon regardless of sender (bot,
// Claude, or a human agent), so the messages table is always the full
// source of truth for what actually left the business number.
async function sendAndLogMessage({ conversationId, waId, text, senderType, sentBy, resetUnread, contextMessageWaId }) {
  let waMessageId = null;
  let status = 'sent';
  let apiError = null;

  try {
    const result = await sendMessage(waId, text, contextMessageWaId);
    if (result?.error) {
      apiError = result.error;
      status = 'failed';
    } else {
      waMessageId = result?.messages?.[0]?.id || null;
    }
  } catch (err) {
    apiError = { message: err.message };
    status = 'failed';
  }

  const message = await recordOutboundMessage({ conversationId, waMessageId, senderType, text, sentBy, status, contextMessageWaId });

  if (status === 'sent') {
    await touchConversationOnOutbound(conversationId, { text, resetUnread: !!resetUnread });
  }

  return { message, error: apiError };
}

module.exports = { sendAndLogMessage };
