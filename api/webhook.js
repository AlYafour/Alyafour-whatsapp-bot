const { getSession, saveSession, defaultSession } = require('../lib/sessionManager');
const { sendMessage, markAsRead } = require('../lib/whatsappApi');
const { getAIResponse, needsHandoff, needsMenu } = require('../lib/aiHandler');
const { isBusinessHours } = require('../lib/businessHours');
const MENUS = require('../lib/menu');

// ─── Webhook verification (GET) ───────────────────────────────────────────────
function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Forbidden' });
}

// ─── Extract first text message from Meta payload ────────────────────────────
function extractMessage(body) {
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return null;

  const text = message.text?.body?.trim();
  if (!text) return null; // ignore non-text (images, voice, etc.)

  return { id: message.id, from: message.from, text };
}

// ─── Step: language selection ─────────────────────────────────────────────────
async function handleLanguageSelection(from, text, session) {
  if (text === '1' || /^ar(abic)?$/i.test(text) || text === 'عربية' || text === 'عربي') {
    session.language = 'ar';
  } else if (text === '2' || /^en(glish)?$/i.test(text)) {
    session.language = 'en';
  } else {
    // Unknown input — resend prompt
    await sendMessage(from, MENUS.ar.languagePrompt);
    return session;
  }

  const menu = MENUS[session.language];

  if (!isBusinessHours()) {
    await sendMessage(from, menu.outOfHours);
    // Keep language set but stay at menu step so they can browse after hours
    session.step = 'main_menu';
    return session;
  }

  session.step = 'main_menu';
  await sendMessage(from, menu.mainMenu);
  return session;
}

// ─── Step: main menu selection ────────────────────────────────────────────────
async function handleMainMenu(from, text, session) {
  const menu = MENUS[session.language];
  const deptName = menu.departments[text];

  if (!deptName) {
    await sendMessage(from, menu.invalidOption + menu.mainMenu);
    return session;
  }

  // Option 9 → human agent immediately
  if (text === '9') {
    await sendMessage(from, menu.humanAgent);
    // Reset to language selection for next conversation
    return defaultSession();
  }

  // Option 8 → working hours info, then allow follow-up questions
  if (text === '8') {
    await sendMessage(from, menu.workingHoursInfo);
    session.step = 'ai_conversation';
    session.department = deptName;
    session.history = [];
    return session;
  }

  session.department = deptName;
  session.step = 'ai_conversation';
  session.history = [];

  await sendMessage(from, menu.aiIntro(deptName));
  return session;
}

// ─── Step: AI conversation ────────────────────────────────────────────────────
async function handleAIConversation(from, text, session) {
  const menu = MENUS[session.language];

  // Go back to main menu
  if (needsMenu(text, session.language)) {
    session.step = 'main_menu';
    session.history = [];
    await sendMessage(from, menu.backToMenu + menu.mainMenu);
    return session;
  }

  // Request human agent
  if (needsHandoff(text, session.language)) {
    await sendMessage(from, menu.humanAgent);
    return defaultSession();
  }

  // Out-of-hours guard (re-check in case they were chatting across the boundary)
  if (!isBusinessHours()) {
    await sendMessage(from, menu.outOfHours);
    return session;
  }

  // Call Claude
  try {
    const aiReply = await getAIResponse(
      text,
      session.history,
      session.department,
      session.language
    );

    // Append to history; cap at 16 messages (8 exchanges) to stay within token budget
    session.history.push(
      { role: 'user', content: text },
      { role: 'assistant', content: aiReply }
    );
    if (session.history.length > 16) {
      session.history = session.history.slice(-16);
    }

    await sendMessage(from, aiReply);
  } catch (err) {
    console.error('AI error:', err);
    await sendMessage(from, menu.humanAgent);
    return defaultSession();
  }

  return session;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method === 'GET') return handleVerification(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const msg = extractMessage(req.body);
    if (!msg) {
      console.log('[WH] no text message in payload (status update or unsupported type)');
      return res.status(200).json({ status: 'ok' });
    }
    console.log('[WH] msg from:', msg.from, '| text:', msg.text);

    const { id, from, text } = msg;

    // Mark message as read (double blue tick) — fire and forget
    markAsRead(id).catch(() => {});

    let session = await getSession(from);

    // New user or expired session → send language prompt
    if (session.step === 'language_selection') {
      if (!session.language && !['1', '2'].includes(text) && !/^(arabic|english|ar|en|عربية|عربي)$/i.test(text)) {
        await sendMessage(from, MENUS.ar.languagePrompt);
        await saveSession(from, session);
        return res.status(200).json({ status: 'ok' });
      }
      session = await handleLanguageSelection(from, text, session);
    } else if (session.step === 'main_menu') {
      session = await handleMainMenu(from, text, session);
    } else if (session.step === 'ai_conversation') {
      session = await handleAIConversation(from, text, session);
    }

    await saveSession(from, session);
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  // Respond 200 after processing so Vercel keeps the function alive until done
  return res.status(200).json({ status: 'ok' });
};
