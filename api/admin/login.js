const { verifyPassword, signToken, setAuthCookie } = require('../../lib/auth');
const { checkLoginRateLimit } = require('../../lib/rateLimiter');
const { isValidEmail, sanitizeText } = require('../../lib/validation');
const { getUserByEmail } = require('../../lib/userService');
const { logAudit } = require('../../lib/conversationService');

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = sanitizeText(req.body?.email, 200).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const ip = getClientIp(req);
  const allowed = await checkLoginRateLimit(`${ip}:${email}`);
  if (!allowed) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    await logAudit({ userId: user.id, action: 'login' });

    return res.status(200).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[admin/login] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
