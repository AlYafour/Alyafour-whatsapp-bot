const { getSession, saveSession, defaultSession, isSessionExpired } = require('../lib/sessionManager');
const { sendMessage, markAsRead } = require('../lib/whatsappApi');
const { getAIResponse, needsHandoff, needsMenu } = require('../lib/aiHandler');
const { isBusinessHours } = require('../lib/businessHours');
const { DEPARTMENTS, buildContactCard } = require('../lib/departments');
const MENUS = require('../lib/menu');

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

// ─── Extract text message from Meta payload ───────────────────────────────────
function extractMessage(body) {
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return null;
  const text = message.text?.body?.trim();
  if (!text) return null;
  return { id: message.id, from: message.from, text };
}

// ─── Detect language from text ────────────────────────────────────────────────
function detectLanguage(text) {
  return /[؀-ۿ]/.test(text) ? 'ar' : 'en';
}

// ─── Handle department selection ──────────────────────────────────────────────
async function handleDeptSelection(from, key, session) {
  const lang = session.language;
  const menu = MENUS[lang];
  const deptName = menu.departments[key];

  if (!deptName) return false; // not a department key

  // Option 9 → human agent
  if (key === '9') {
    await sendMessage(from, menu.humanAgent);
    session.step = 'chat';
    session.department = null;
    session.history = [];
    return true;
  }

  // Option 8 → working hours
  if (key === '8') {
    await sendMessage(from, menu.workingHoursInfo);
    session.department = deptName;
    return true;
  }

  session.department = deptName;
  session.departmentKey = key;

  const contactCard = buildContactCard(DEPARTMENTS[key], lang);
  await sendMessage(from, menu.deptIntro(deptName));
  if (contactCard) await sendMessage(from, contactCard);
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method === 'GET') return handleVerification(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const msg = extractMessage(req.body);
    if (!msg) return res.status(200).json({ status: 'ok' });

    const { id, from, text } = msg;
    console.log('[WH] from:', from, '| text:', text);

    markAsRead(id).catch(() => {});

    let session = await getSession(from);

    // ── Fresh start or inactivity timeout ──────────────────────────────────────
    const isNew = session.step === 'language_selection' && !session.language;
    const timedOut = session.step !== 'language_selection' && isSessionExpired(session);

    if (isNew || timedOut) {
      const lang = detectLanguage(text);
      session = defaultSession();
      session.language = lang;
      session.step = 'chat';
      session.lastActivity = Date.now();

      if (!isBusinessHours()) {
        await sendMessage(from, MENUS[lang].outOfHours);
        await saveSession(from, session);
        return res.status(200).json({ status: 'ok' });
      }

      await sendMessage(from, MENUS[lang].welcome);
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    session.lastActivity = Date.now();

    // ── Auto-detect language if not set ───────────────────────────────────────
    if (!session.language) session.language = detectLanguage(text);
    const lang = session.language;
    const menu = MENUS[lang];

    // ── Keyword: show menu ─────────────────────────────────────────────────────
    if (needsMenu(text, lang)) {
      await sendMessage(from, menu.menu);
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    // ── Keyword: human agent ───────────────────────────────────────────────────
    if (needsHandoff(text, lang)) {
      await sendMessage(from, menu.humanAgent);
      session.department = null;
      session.history = [];
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    // ── Number 1–9: department selection ──────────────────────────────────────
    if (/^[1-9]$/.test(text.trim())) {
      const handled = await handleDeptSelection(from, text.trim(), session);
      if (handled) {
        await saveSession(from, session);
        return res.status(200).json({ status: 'ok' });
      }
    }

    // ── Out-of-hours check ─────────────────────────────────────────────────────
    if (!isBusinessHours()) {
      await sendMessage(from, menu.outOfHours);
      await saveSession(from, session);
      return res.status(200).json({ status: 'ok' });
    }

    // ── AI answers the question ────────────────────────────────────────────────
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

      await sendMessage(from, aiReply);
    } catch (err) {
      console.error('[AI error]', err.message);
      await sendMessage(from, menu.humanAgent);
      session.history = [];
    }

    await saveSession(from, session);
  } catch (err) {
    console.error('[WH error]', err.message);
  }

  return res.status(200).json({ status: 'ok' });
};
