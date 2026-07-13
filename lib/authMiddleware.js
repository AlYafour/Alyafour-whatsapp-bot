const { getTokenFromReq, verifyToken } = require('./auth');
const { sql } = require('./db');

// Wraps a Vercel API handler with cookie/JWT auth. Re-checks `active` in the
// database on every request so a deactivated user is locked out immediately,
// not just after their token expires.
function withAuth(handler, options = {}) {
  const allowedRoles = options.roles || null;

  return async (req, res) => {
    try {
      const token = getTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = verifyToken(token);
      if (!payload?.sub) return res.status(401).json({ error: 'Unauthorized' });

      const rows = await sql`
        SELECT id, name, email, role, active
        FROM admin_users
        WHERE id = ${payload.sub}
      `;
      const user = rows[0];
      if (!user || !user.active) return res.status(401).json({ error: 'Unauthorized' });

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.user = user;
      return await handler(req, res);
    } catch (err) {
      console.error('[auth] middleware error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = { withAuth };
