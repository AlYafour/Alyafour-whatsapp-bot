const { withAuth } = require('../../../lib/authMiddleware');
const { getUserById, updateUser } = require('../../../lib/userService');
const { isValidUuid, sanitizeText } = require('../../../lib/validation');
const { logAudit } = require('../../../lib/conversationService');

module.exports = withAuth(
  async (req, res) => {
    const { id } = req.query;
    if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid user id' });

    if (req.method === 'PATCH') {
      try {
        const existing = await getUserById(id);
        if (!existing) return res.status(404).json({ error: 'User not found' });

        const fields = {};
        if (req.body?.name !== undefined) fields.name = sanitizeText(req.body.name, 200);
        if (req.body?.role !== undefined) fields.role = req.body.role === 'agent' ? 'agent' : 'admin';
        if (req.body?.active !== undefined) fields.active = !!req.body.active;
        if (typeof req.body?.password === 'string' && req.body.password.length >= 8) {
          fields.password = req.body.password;
        }

        const user = await updateUser(id, fields);
        await logAudit({
          userId: req.user.id,
          action: 'update_user',
          metadata: { updatedUserId: id, fields: Object.keys(fields) },
        });
        return res.status(200).json({ user });
      } catch (err) {
        console.error('[admin/users/:id] update error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  },
  { roles: ['admin'] }
);
