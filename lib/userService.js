const { sql } = require('./db');
const { hashPassword } = require('./auth');

const SAFE_COLUMNS = 'id, name, email, role, active, created_at, updated_at';

async function listUsers() {
  return sql`SELECT id, name, email, role, active, created_at, updated_at FROM admin_users ORDER BY created_at DESC`;
}

async function getUserById(id) {
  const rows = await sql`SELECT id, name, email, role, active, created_at, updated_at FROM admin_users WHERE id = ${id}`;
  return rows[0] || null;
}

async function getUserByEmail(email) {
  const rows = await sql`SELECT * FROM admin_users WHERE email = ${email}`;
  return rows[0] || null;
}

async function createUser({ name, email, password, role }) {
  const passwordHash = await hashPassword(password);
  const rows = await sql`
    INSERT INTO admin_users (name, email, password_hash, role, active)
    VALUES (${name}, ${email}, ${passwordHash}, ${role}, true)
    RETURNING id, name, email, role, active, created_at, updated_at
  `;
  return rows[0];
}

async function updateUser(id, fields = {}) {
  const name = fields.name ?? null;
  const role = fields.role ?? null;
  const active = fields.active === undefined ? null : fields.active;
  const passwordHash = fields.password ? await hashPassword(fields.password) : null;

  const rows = await sql`
    UPDATE admin_users
    SET name = COALESCE(${name}, name),
        role = COALESCE(${role}, role),
        active = COALESCE(${active}, active),
        password_hash = COALESCE(${passwordHash}, password_hash),
        updated_at = now()
    WHERE id = ${id}
    RETURNING id, name, email, role, active, created_at, updated_at
  `;
  return rows[0] || null;
}

module.exports = { listUsers, getUserById, getUserByEmail, createUser, updateUser, SAFE_COLUMNS };
