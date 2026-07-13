# Al Yafour WhatsApp Bot + Customer Support Inbox

WhatsApp Cloud API bot for Al Yafour General Contracting LLC, plus a secure
customer-support dashboard where employees can take over a conversation from
the bot and reply manually through the same WhatsApp number.

## Architecture

- `api/webhook.js` — Meta WhatsApp webhook (`GET` verification + `POST` events). URL stays `/api/webhook` (also aliased at `/webhook`).
- `lib/` — bot logic (menus, Claude AI, business hours, Upstash sessions) plus the new persistence/auth layer:
  - `db.js` — Neon Postgres client (`@neondatabase/serverless`).
  - `conversationService.js` — conversations/messages/audit-log queries.
  - `messagingService.js` — `sendAndLogMessage()`, used by the bot and by agents so every outbound message is logged.
  - `auth.js` / `authMiddleware.js` / `rateLimiter.js` — bcrypt + JWT cookie auth, login rate limiting.
  - `userService.js` — admin_users CRUD.
- `api/admin/**` — authenticated dashboard API (login/logout/me, conversations, users).
- `dashboard/` — Arabic-first React/Vite PWA (login, conversation inbox, user management).
- `migrations/001_init.sql` — Postgres schema.
- `scripts/create-admin.js`, `scripts/migrate.js` — CLI tooling.

Upstash Redis keeps the *temporary* bot session (language, menu step, AI
history). Neon Postgres is the *permanent* store for conversations, messages
and admin users. The webhook always writes to Neon before running any bot
logic, and stays silent whenever a conversation is in `human` mode.

## 1. Local setup

```bash
npm install
npm --prefix dashboard install
cp .env.example .env.local   # fill in real values, never commit this file
```

Run the bot functions locally with the Vercel CLI, and the dashboard with Vite
(proxies `/api` to `http://localhost:3000` — see `dashboard/vite.config.js`):

```bash
npx vercel dev        # serves api/* on :3000
npm run dev:dashboard  # serves the dashboard on :5173 with hot reload
```

## 2. Neon Postgres setup

1. Create a free project at https://neon.tech and copy the pooled connection string into `DATABASE_URL`.
2. Apply the schema:

   ```bash
   npm run migrate
   ```

   This runs every `*.sql` file in `migrations/` against `DATABASE_URL` (currently just `001_init.sql`). It's safe to re-run — every statement uses `IF NOT EXISTS`.

## 3. Create the first admin user

```bash
npm run create-admin -- --name "Admin" --email "admin@example.com" --password "change-me-please" --role admin
```

- Requires `DATABASE_URL` to be set (loaded from `.env.local`/`.env`).
- Re-running with the same email updates the name/password/role instead of failing (`ON CONFLICT ... DO UPDATE`), which is also how you reset a forgotten password.
- Password must be at least 8 characters. Passwords are hashed with bcrypt before storage — plain passwords are never saved or logged.

## 4. Environment variables

| Variable | Purpose |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API access token (never sent to the frontend) |
| `PHONE_NUMBER_ID` | WhatsApp Business phone number ID |
| `VERIFY_TOKEN` | Shared secret for webhook `GET` verification |
| `ANTHROPIC_API_KEY` | Claude API key for AI replies |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Temporary bot session state |
| `DATABASE_URL` | Neon Postgres connection string — permanent conversations/messages |
| `AUTH_SECRET` | JWT signing secret for the dashboard (`openssl rand -base64 48`) |
| `APP_URL` | Public URL of the deployment (used in docs/links) |

See `.env.example` for the full annotated list.

## 5. Vercel deployment

1. Import the repo into Vercel. Project settings are already encoded in `vercel.json`:
   - `buildCommand: npm run build` (installs and builds `dashboard/`)
   - `outputDirectory: dashboard/dist`
   - `/api/**/*.js` is auto-detected as Serverless Functions regardless of `outputDirectory`.
2. Add all environment variables from the table above in **Project Settings → Environment Variables**.
3. Deploy, then run the migration and create-admin steps against the production `DATABASE_URL` (from your local machine or a one-off script), or via `vercel env pull` + the commands above.
4. Point the Meta webhook at `https://<your-app>/api/webhook` (unchanged) or `https://<your-app>/webhook` (aliased).
5. Open `https://<your-app>/dashboard`, log in, and optionally install the PWA from the browser's install prompt.

## 6. Testing / acceptance walkthrough

1. Message the bot normally — menus, department selection, Claude AI answers, business-hours behavior are unchanged.
2. Send `9` (or a handoff keyword like "موظف"/"agent"). The bot replies with the human-agent message **once**, and the conversation appears under the "بانتظار التحويل" (pending) filter in the dashboard.
3. Send another message — it shows up in the dashboard thread and the bot stays silent (mode = `human`).
4. Log in to `/login`, open the conversation, click "استلام المحادثة" to claim it, and reply from the composer.
5. The customer receives the reply on the same WhatsApp chat; their next reply appears in the dashboard within ~3 seconds (polling).
6. Click "إعادة للبوت" (with confirmation) — the bot resumes normal menu/AI behavior for that customer.
7. Resend the same webhook payload (same `wa_message_id`) — no duplicate row is created in `messages` (`ON CONFLICT (wa_message_id) DO NOTHING`).
8. Log out / use an unauthenticated request — every `/api/admin/*` route returns `401`.
9. Wait past 24h since `last_customer_message_at` (or edit the timestamp in Neon for a quick test) — the reply endpoint returns `422 TEMPLATE_REQUIRED` and the composer shows the template-required notice instead of silently failing.
10. `GET /api/webhook?hub.mode=subscribe&hub.verify_token=...` still returns the challenge; `POST /api/webhook` still returns `200` quickly even if Neon/WhatsApp calls fail.

## 7. Modified / created files

**Modified:** `api/webhook.js`, `package.json`, `vercel.json`, `.env.example`, `.gitignore`

**Created:**
- `lib/db.js`, `lib/conversationService.js`, `lib/messagingService.js`, `lib/auth.js`, `lib/authMiddleware.js`, `lib/rateLimiter.js`, `lib/userService.js`, `lib/validation.js`
- `migrations/001_init.sql`
- `scripts/migrate.js`, `scripts/create-admin.js`
- `api/admin/login.js`, `logout.js`, `me.js`
- `api/admin/conversations/index.js`, `[id]/index.js`, `[id]/reply.js`, `[id]/claim.js`, `[id]/release.js`, `[id]/human.js`, `[id]/bot.js`, `[id]/read.js`, `[id]/close.js`, `[id]/reopen.js`
- `api/admin/users/index.js`, `[id].js`
- `dashboard/` — full Vite/React app (login, dashboard inbox, user management, PWA manifest + service worker)

## 8. Security notes

- `WHATSAPP_ACCESS_TOKEN`, `DATABASE_URL`, `AUTH_SECRET`, and `ANTHROPIC_API_KEY` are only read server-side (`api/**`, `lib/**`); nothing in `dashboard/src` references `process.env` for secrets — the dashboard only ever calls same-origin `/api/admin/*` endpoints with `credentials: 'include'`.
- Auth cookie is `httpOnly`, `sameSite: lax`, and `secure` in production.
- Every `/api/admin/*` route is wrapped in `withAuth()`, which re-checks the user is still `active` on every request.
- Login is rate-limited (8 attempts / 15 min per IP+email, via Upstash) and fails open only if Redis itself is down.
- All SQL is parameterized (tagged templates / `$1, $2, …`) — no string-concatenated queries.
