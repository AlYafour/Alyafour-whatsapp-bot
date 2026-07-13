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
- `migrations/001_init.sql` — Postgres schema. `002_template_messages.sql` — `template` messages. `003_wa_id_history.sql` — number-change history. `004_rich_media.sql` — image/video/audio/voice/document/sticker/location/contacts/reaction/interactive/system columns. All additive/production-safe.
- `scripts/create-admin.js`, `scripts/migrate.js` — CLI tooling.
- `tests/` — `node --test` backend suite (system events, media validation, auth, 24h window). `dashboard/tests/i18n.test.js` — Arabic/English translation-key parity.

### Phone number changes (`system.type = "user_changed_number"`)

- `lib/conversationService.js#handlePhoneNumberChange()` — renames the conversation's `wa_id` to the new number inside a Neon transaction (`lib/db.js#transaction()`, batched via `@neondatabase/serverless`'s `sql.transaction()`); if a conversation already existed under the new number, its messages are moved onto the original conversation and the duplicate row is deleted — no history is lost or duplicated.
- `migrations/003_wa_id_history.sql` — `wa_id_history` table keeps every old→new number pair per conversation, permanently.
- `api/webhook.js#handleSystemMessage()` — stores the event as a `message_type: 'system'` row (idempotent on `wa_message_id`, so redelivery is a no-op), never increments `unread_count`, never touches `last_customer_message_at` (so it can't open the 24h window), and returns before any bot/menu/AI code runs.
- The dashboard renders it as a centered system pill: "قام العميل بتغيير رقم واتساب من {old} إلى {new}" / the English equivalent — never as a chat bubble, never as "[unsupported message]".

### Rich media (images, video, audio/voice, documents, stickers, location, contacts, reactions, interactive replies)

- `lib/mediaLimits.js` — the *current* official Cloud API allowlist/size limits per type (verified against `developers.facebook.com/docs/whatsapp/cloud-api/reference/media` while building this — image 5MB JPEG/PNG, video 16MB MP4/3GPP, audio/voice 16MB AAC/MP4/MPEG/AMR/OGG-Opus, document 100MB, sticker 100KB static/500KB animated WEBP), plus a magic-byte `sniffMimeType()` so uploads are validated against actual file content, not just filename/declared type.
- `lib/storage.js` — thin Vercel Blob (`@vercel/blob`) wrapper; swap providers by editing this one file.
- `lib/mediaDownload.js` — fetches Meta's short-lived, Bearer-token-gated media URL and downloads the bytes server-side (`WHATSAPP_ACCESS_TOKEN` never reaches the browser).
- **Lazy download, not eager**: `api/webhook.js` only ever persists *metadata* (`media_id`, `mime_type`, `caption`, `filename`, `media_status: 'pending'`) — it never downloads or blocks the webhook's `200` response on a slow Meta/storage round trip. The actual download + Vercel Blob upload happens on first authenticated view, in `GET /api/admin/media/:messageId`, which then flips `media_status` to `stored` (cached for every later request) or `failed` (returns a retriable `502 MEDIA_DOWNLOAD_FAILED`).
- `api/admin/media/[messageId].js` — verifies the session, streams the file with correct `Content-Type`/`Content-Disposition` (`inline` for image/video/audio/voice/sticker, `attachment` otherwise), never exposes the Meta or Blob URL to the client.
- `api/admin/conversations/[id]/attachments.js` — agent-side upload+send for image/video/document/audio/voice/sticker. The raw file bytes are the request body (no multipart parser dependency needed); metadata travels via query params. Validates the 24h window, MIME/size against `lib/mediaLimits.js`, uploads to Meta's Media API (`lib/whatsappMedia.js`), sends the message, and archives a copy in Blob storage.
- `api/admin/conversations/[id]/location.js`, `.../contact.js`, `.../react.js` — location/contact/reaction sending, same auth + 24h-window + audit-log pattern as replies.
- Reactions and contextual (reply-to) references are stored as their own columns (`reacted_message_wa_id`, `context_message_wa_id`) — the dashboard attaches a reaction as a small badge on its target bubble (never a standalone bubble) and renders a quoted preview above a contextual reply.

### Voice recording

`dashboard/src/hooks/useVoiceRecorder.js` uses `MediaRecorder`, preferring a WhatsApp-compatible container directly (`audio/mp4` on Safari, `audio/ogg;codecs=opus` on Firefox). Chrome/Edge only expose `audio/webm`, which the Cloud API rejects — for those, the hook lazy-loads `@ffmpeg/ffmpeg` (client-side WASM, loaded only when the recorder opens, never blocking the main bundle) and re-encodes to `audio/ogg`. If that conversion fails, the recorder clearly disables "Send" rather than uploading a file WhatsApp would reject. **This ffmpeg.wasm path could not be exercised in a real browser during this session** — treat it as a best-effort progressive enhancement and QA it manually on Chrome/Edge before relying on it in production; Safari/Firefox need no conversion at all.

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

   This runs every `*.sql` file in `migrations/` against `DATABASE_URL` in order (`001_init.sql` → `002_template_messages.sql` → `003_wa_id_history.sql` → `004_rich_media.sql`). It's safe to re-run — every statement uses `IF NOT EXISTS` / `DROP ... IF EXISTS` first, and none of them delete existing data.
3. Create a Vercel Blob store (Vercel dashboard → your project → **Storage** → **Create Database** → **Blob**) and copy the generated read/write token into `BLOB_READ_WRITE_TOKEN`. This backs the media proxy described below — without it, inbound/outbound media can't be archived (text, templates, location, and contacts still work fine).

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
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token — stores archived media referenced by `messages.storage_key`/`storage_url` |
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

### Rich-media / system-event walkthrough

1. Ask the customer's phone to "change number" in WhatsApp (Settings → Account → Change Number) to trigger a real `user_changed_number` webhook — the conversation keeps its full history and simply appears under its new number; no second conversation is created. (For a scripted check without a real device, see `tests/webhook.test.js`.)
2. Send an image/video/document/voice note/sticker/location/contact from the customer's phone — each is stored immediately (metadata only) and renders correctly once opened (image lightbox, video player, document download, audio/voice player with speed control, sticker, map link, contact card).
3. Open a media message for the first time — it downloads from Meta and caches to Vercel Blob (`media_status: pending → stored`); reopening it is instant (served from storage, not re-fetched from Meta).
4. Temporarily break `WHATSAPP_ACCESS_TOKEN` and open a not-yet-cached media message — you get a clear `502 MEDIA_DOWNLOAD_FAILED` with `retriable: true`, `media_status` becomes `failed`, and the webhook itself was never blocked or crashed by this.
5. React to a customer's message from the dashboard (hover a bubble → 😊) — the emoji badge attaches to that exact bubble, not a new one; picking the same emoji again removes it.
6. Reply to a specific message (hover → reply icon) — the sent message shows a quoted preview of the original both in the dashboard and on the customer's WhatsApp.
7. From the composer, send an image with a caption, a document, a location, and a contact — each appears correctly in the thread and on the customer's phone; attempting any of them outside the 24h window returns `422 TEMPLATE_REQUIRED` instead of failing silently.
8. Record a voice note (mic icon) on Firefox or Safari — it sends directly as a compatible format. On Chrome/Edge it attempts an in-browser conversion first; if that fails, "Send" stays disabled with a clear explanation instead of uploading a broken file.
9. `npm test` (run from the repo root) — all backend + translation-parity tests pass with zero failures.

## 7. Redesign & localization

- Tailwind CSS v4 (`@tailwindcss/vite`) drives all new styling via CSS-variable design tokens in `dashboard/src/styles.css` (`--color-brand`, `--color-surface`, etc.), redefined per `[data-theme="dark"]` — light/dark/system, persisted in `localStorage`, toggled from the header (`ThemeToggle`).
- `react-i18next` (`dashboard/src/i18n.js`, `locales/ar.json`, `locales/en.json`) — Arabic is the default; the language switcher persists the choice and flips `<html lang/dir>` between `rtl`/`ltr` live, including message alignment, sidebar side, and icon mirroring (back-arrow direction). `dashboard/tests/i18n.test.js` asserts both locale files expose identical keys.
- Accessible primitives (`dashboard/src/components/ui/`) are hand-built on Radix UI (`Dialog`, `DropdownMenu`, `Tooltip`) since no shadcn MCP was available in this session — same approach shadcn/ui itself uses (owned source, not a black-box dependency).
- `motion` (the current name for Framer Motion) drives the toast-notification transitions; kept intentionally restrained elsewhere per the "no childish/glassmorphism" brief.
- Responsive layout: the conversation list and the active chat share one flex row that collapses to a single full-screen pane on mobile (Tailwind `md:` breakpoint), with a back button restoring the list; dialogs (`ui/Dialog.jsx`) dock to the bottom of the screen on mobile and center as a card on desktop.
- Backend error codes (`INVALID_PHONE`, `TEMPLATE_REQUIRED`, `MEDIA_DOWNLOAD_FAILED`, …) are mapped to localized strings client-side (`dashboard/src/utils/apiError.js`, `locales/*.errors`), falling back to the server's own message for anything unmapped.

## 8. Testing

```bash
npm test          # node --test — backend + i18n-parity suite, ~40 tests, no network/DB required
npm run build     # installs + builds the dashboard (also part of `vercel build`)
```

The suite fakes `lib/db.js`, `lib/metaGraph.js`, `lib/whatsappApi.js`, `lib/idempotency.js`, and `lib/mediaDownload.js` via Node's `require.cache` (see `tests/helpers/`) — no real Neon/Upstash/Meta credentials are needed to run it.

## 9. Modified / created files

**Modified:** `api/webhook.js` (system events + full rich-media classification), `lib/conversationService.js` (phone-change transaction, media/system/reaction fields), `lib/rateLimiter.js`, `lib/whatsappApi.js` (contextual replies), `lib/messagingService.js`, `lib/db.js` (`transaction()`), `api/admin/conversations/[id]/reply.js`, `package.json`, `vercel.json`, `.env.example`, `.gitignore`, `README.md`, and the full `dashboard/src/**` (redesign — see below).

**Created — backend:**
- `migrations/003_wa_id_history.sql`, `migrations/004_rich_media.sql`
- `lib/mediaLimits.js`, `lib/storage.js`, `lib/mediaDownload.js`, `lib/whatsappMedia.js`, `lib/rawBody.js`
- `api/admin/media/[messageId].js`
- `api/admin/conversations/[id]/attachments.js`, `location.js`, `contact.js`, `react.js`
- `tests/` — `helpers/fakeDb.js`, `helpers/fakeModule.js`, `phone.test.js`, `mediaLimits.test.js`, `templateService.test.js`, `auth.test.js`, `webhook.test.js`, `adminEndpoints.test.js`, `mediaEndpoint.test.js`

**Created — dashboard:**
- `src/i18n.js`, `src/locales/ar.json`, `src/locales/en.json`
- `src/contexts/ThemeContext.jsx`, `src/contexts/ToastContext.jsx`
- `src/components/ui/Button.jsx`, `Dialog.jsx`, `DropdownMenu.jsx`, `Tooltip.jsx`
- `src/components/ThemeToggle.jsx`, `LanguageToggle.jsx`, `AudioPlayer.jsx`, `VoiceRecorder.jsx`, `LocationPicker.jsx`, `ContactPicker.jsx`, `Lightbox.jsx`
- `src/hooks/useVoiceRecorder.js`
- `src/utils/apiError.js`
- `tests/i18n.test.js`

Rewritten in place (same filename, new implementation): `dashboard/src/{App,api,styles}.{jsx,js,css}`, `pages/{Login,Dashboard,Users}.jsx`, `components/{Filters,ConversationListItem,MessageBubble,Composer,ConfirmDialog,NewConversationModal}.jsx`, `utils/format.js`.

## 10. Security notes

- `WHATSAPP_ACCESS_TOKEN`, `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, and `BLOB_READ_WRITE_TOKEN` are only read server-side (`api/**`, `lib/**`); nothing in `dashboard/src` references `process.env` for secrets — the dashboard only ever calls same-origin `/api/admin/*` endpoints with `credentials: 'include'`.
- Media is never served from a public Meta or Blob URL directly — every file goes through the authenticated `GET /api/admin/media/:messageId` proxy, which re-checks the session on every request.
- Uploaded/downloaded media is validated against the *actual file bytes* (`lib/mediaLimits.js#sniffMimeType()`), not just the declared `Content-Type` or filename, and rejected outside Meta's official per-type size limits.
- Auth cookie is `httpOnly`, `sameSite: lax`, and `secure` in production; every `/api/admin/*` route re-checks the user is still `active` on every request.
- Login is rate-limited (8/15min per IP+email); template sends (20/5min) and media sends (40/5min) are rate-limited per user, all via Upstash, all fail-open only on a Redis outage.
- Template sends, attachments, and (implicitly, via `wa_message_id` `ON CONFLICT DO NOTHING`) inbound messages are idempotency-protected against double-clicks/retries — verified in `tests/adminEndpoints.test.js` that a duplicate request never reaches the Meta API a second time.
- `POST /api/admin/conversations/new` never sends to the business's own WhatsApp number (checked via `getOwnPhoneNumber()`); every send endpoint validates the 24-hour service window server-side — the frontend check is a UX convenience, not the security boundary.
- All SQL is parameterized (tagged templates / `$1, $2, …`) — no string-concatenated queries, including the new phone-change transaction.
- Filenames are sanitized before being reflected in `Content-Disposition`; nothing derived from user input is used to build a filesystem path (media is addressed by UUID `messageId` + Blob storage key, not by filename).

## 11. Known limitations

- The Chrome/Edge voice-note path (client-side ffmpeg.wasm re-encode) is implemented against the documented `@ffmpeg/ffmpeg` v0.12 API but **was not exercised in a live browser** in this session — QA it manually before relying on it; Safari/Firefox record a compatible format natively and need no conversion.
- Animated sticker playback relies on the browser's native animated-WebP support in an `<img>` tag (universal in current browsers) — there's no custom animation handling beyond that.
- Sending stickers from the dashboard requires the agent to already have a valid `.webp` sticker file; there's no in-app sticker creation/picker (out of scope — Meta doesn't expose one via the Cloud API either).
- The main dashboard JS bundle is ~525 kB minified / ~168 kB gzipped (Radix + i18next + motion + lucide-react); acceptable for an internal tool, but a candidate for route-level code-splitting if it grows further.
- `npm audit` reports a moderate/high advisory in `esbuild`'s Vite-dev-server-only code path (pre-existing, not present in production builds); no fix is available yet that isn't a breaking Vite major-version bump.
