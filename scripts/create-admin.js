#!/usr/bin/env node
// Creates (or updates) an admin/agent user in Neon Postgres.
// Usage:
//   npm run create-admin -- --name "Admin" --email "admin@example.com" --password "password" [--role admin|agent]
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = value;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { name, email, password } = args;
  const role = args.role === 'agent' ? 'agent' : 'admin';

  if (!name || !email || !password) {
    console.error('Usage: npm run create-admin -- --name "Admin" --email "admin@example.com" --password "password" [--role admin|agent]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or .env.local.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = String(email).trim().toLowerCase();

  const rows = await sql`
    INSERT INTO admin_users (name, email, password_hash, role, active)
    VALUES (${name}, ${normalizedEmail}, ${passwordHash}, ${role}, true)
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          active = true,
          updated_at = now()
    RETURNING id, name, email, role
  `;

  console.log('User ready:', rows[0]);
}

main().catch((err) => {
  console.error('create-admin failed:', err.message);
  process.exit(1);
});
