const { withAuth } = require('../../../lib/authMiddleware');
const { listUsers, createUser } = require('../../../lib/userService');
const { isValidEmail, sanitizeText } = require('../../../lib/validation');
const { logAudit } = require('../../../lib/conversationService');

module.exports = withAuth(
  async (req, res) => {
    if (req.method === 'GET') {
      try {
        const users = await listUsers();
        return res.status(200).json({ users });
      } catch (err) {
        console.error('[admin/users] list error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    if (req.method === 'POST') {
      const name = sanitizeText(req.body?.name, 200);
      const email = sanitizeText(req.body?.email, 200).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const role = req.body?.role === 'agent' ? 'agent' : 'admin';

      if (!name || !isValidEmail(email) || password.length < 8) {
        return res.status(400).json({ error: 'name, valid email, and password (min 8 chars) are required' });
      }

      try {
        const user = await createUser({ name, email, password, role });
        await logAudit({ userId: req.user.id, action: 'create_user', metadata: { createdUserId: user.id } });
        return res.status(201).json({ user });
      } catch (err) {
        if (err.message?.toLowerCase().includes('duplicate key')) {
          return res.status(409).json({ error: 'A user with this email already exists' });
        }
        console.error('[admin/users] create error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  },
  { roles: ['admin'] }
);
