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
- `api/admin/**` — authenticated dashboard API (login/logout/me, conversations, users, templates, new-conversation).
- `dashboard/` — Arabic-first React/Vite PWA (login, conversation inbox, user management, new-conversation modal).
- `migrations/001_init.sql` — Postgres schema. `migrations/002_template_messages.sql` — adds `template` message support (additive, production-safe).
- `scripts/create-admin.js`, `scripts/migrate.js` — CLI tooling.

### New Conversation (agent/admin-initiated, template messages)

- `lib/phone.js` — normalizes phone input to bare E.164 digits, rejects anything else.
- `lib/metaGraph.js` — small Graph API GET/POST wrapper (never logs the token).
- `lib/whatsappTemplates.js` — `getOwnPhoneNumber()` (used to block sending to the business's own number) and `sendTemplateMessage()`.
- `lib/templateService.js` — fetches **APPROVED** templates from Meta (`WHATSAPP_BUSINESS_ACCOUNT_ID`), groups them by name/language, extracts required variables (`{{n}}` in header/body, dynamic URL buttons), validates a caller's `components` payload, and renders a text preview.
- `lib/idempotency.js` — Upstash-backed `claimIdempotencyKey()` to stop double-clicks/retries from sending twice.
- `GET /api/admin/templates` — list approved templates (any authenticated admin/agent).
- `POST /api/admin/conversations/new` — validates phone + template + variables, sends the template, upserts the conversation (`mode: human`, `status: pending`, assigned to the sender), logs the outbound `template` message, and audit-logs the action.

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

   This runs every `*.sql` file in `migrations/` against `DATABASE_URL` in order (`001_init.sql`, then `002_template_messages.sql`). It's safe to re-run — every statement uses `IF NOT EXISTS` / `DROP ... IF EXISTS` first. `002` only adds a `template` message type and two nullable columns (`template_name`, `template_language`) — it never deletes existing data.

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
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID — required to list approved templates for "New Conversation" |
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

### New Conversation walkthrough

1. Log in, click **"+ محادثة جديدة"** in the sidebar.
2. Enter a phone number that has never messaged the business, e.g. `971501234567`.
3. Approved templates load from Meta; pick one, pick a language — required variables render as inputs dynamically (body, header text/media, dynamic URL buttons), with a live preview.
4. Send. The conversation is created (or reused, if that number already had one) with `mode: human`, `status: pending`, assigned to you; the outgoing template appears in the thread.
5. The customer receives it on WhatsApp. The composer shows "بانتظار رد العميل…" — free text stays blocked.
6. When the customer replies, the existing webhook updates `last_customer_message_at`; the 24h window opens and normal free-form replies become available in the same conversation.
7. An invalid phone (letters, no country code, the business's own number) is rejected client- and server-side with a clear Arabic message; missing template variables return `TEMPLATE_PARAMETERS_REQUIRED`.
8. Double-clicking "إرسال" only ever sends once (button disables immediately; the backend also rejects the repeat via `Idempotency-Key`/`DUPLICATE_REQUEST`).
9. A logged-out request to `/api/admin/templates` or `/api/admin/conversations/new` returns `401`.

## 7. Modified / created files

**Modified:** `api/webhook.js`, `package.json`, `vercel.json`, `.env.example`, `.gitignore`, `README.md`, `lib/conversationService.js` (template message support + agent-assigned handoff), `lib/rateLimiter.js` (generic rate-limit helper), `dashboard/src/api.js`, `dashboard/src/pages/Dashboard.jsx`, `dashboard/src/components/MessageBubble.jsx`, `dashboard/src/styles.css`

**Created:**
- `lib/db.js`, `lib/messagingService.js`, `lib/auth.js`, `lib/authMiddleware.js`, `lib/userService.js`, `lib/validation.js`
- `lib/phone.js`, `lib/metaGraph.js`, `lib/whatsappTemplates.js`, `lib/templateService.js`, `lib/idempotency.js`
- `migrations/001_init.sql`, `migrations/002_template_messages.sql`
- `scripts/migrate.js`, `scripts/create-admin.js`
- `api/admin/login.js`, `logout.js`, `me.js`, `templates.js`
- `api/admin/conversations/index.js`, `new.js`, `[id]/index.js`, `[id]/reply.js`, `[id]/claim.js`, `[id]/release.js`, `[id]/human.js`, `[id]/bot.js`, `[id]/read.js`, `[id]/close.js`, `[id]/reopen.js`
- `api/admin/users/index.js`, `[id].js`
- `dashboard/` — full Vite/React app (login, dashboard inbox, user management, new-conversation modal, PWA manifest + service worker)

## 8. Security notes

- `WHATSAPP_ACCESS_TOKEN`, `DATABASE_URL`, `AUTH_SECRET`, and `ANTHROPIC_API_KEY` are only read server-side (`api/**`, `lib/**`); nothing in `dashboard/src` references `process.env` for secrets — the dashboard only ever calls same-origin `/api/admin/*` endpoints with `credentials: 'include'`.
- Auth cookie is `httpOnly`, `sameSite: lax`, and `secure` in production.
- Every `/api/admin/*` route is wrapped in `withAuth()`, which re-checks the user is still `active` on every request.
- Login is rate-limited (8 attempts / 15 min per IP+email, via Upstash) and fails open only if Redis itself is down.
- Sending templates is rate-limited (20 / 5 min per user) and idempotency-protected (`Idempotency-Key` header, 120s window) to stop duplicate sends from double-clicks or client retries.
- `POST /api/admin/conversations/new` never sends to the business's own WhatsApp number (checked via `getOwnPhoneNumber()`), only sends templates Meta reports as `APPROVED`, and validates every required variable server-side before calling the Cloud API — the frontend check is a UX convenience, not the security boundary.
- All SQL is parameterized (tagged templates / `$1, $2, …`) — no string-concatenated queries.
