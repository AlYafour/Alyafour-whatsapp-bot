const { neon } = require('@neondatabase/serverless');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// Tagged-template usage: sql`SELECT * FROM t WHERE id = ${id}`
function sql(strings, ...values) {
  return getClient()(strings, ...values);
}

// Parameterized usage for dynamically built queries: query('SELECT ... WHERE x = $1', [x])
function query(text, params = []) {
  return getClient().query(text, params);
}

module.exports = { sql, query };
