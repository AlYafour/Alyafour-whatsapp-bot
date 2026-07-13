#!/usr/bin/env node
// Runs SQL migration files in migrations/ against DATABASE_URL (Neon Postgres).
// Usage: npm run migrate
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or .env.local.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`\n▶ Running migration: ${file}`);
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const statements = content
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.query(statement);
    }
    console.log(`✔ ${file} applied (${statements.length} statements)`);
  }

  console.log('\nAll migrations applied successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
