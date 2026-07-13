-- Al Yafour WhatsApp Bot — Customer Support Inbox schema
-- Run against Neon PostgreSQL. Safe to re-run (IF NOT EXISTS everywhere).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── admin_users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── conversations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id                     TEXT NOT NULL UNIQUE,
  customer_name             TEXT,
  mode                      TEXT NOT NULL DEFAULT 'bot' CHECK (mode IN ('bot', 'human')),
  status                    TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  department                TEXT,
  assigned_to               UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  unread_count              INTEGER NOT NULL DEFAULT 0,
  last_message_preview      TEXT,
  last_message_at           TIMESTAMPTZ,
  last_customer_message_at  TIMESTAMPTZ,
  handoff_requested_at      TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  wa_message_id   TEXT UNIQUE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type     TEXT NOT NULL CHECK (sender_type IN ('customer', 'bot', 'agent')),
  message_type    TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'unknown')),
  text            TEXT,
  media_id        TEXT,
  status          TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  sent_by         UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  raw_payload     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  conversation_id UUID,
  action          TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_mode            ON conversations (mode);
CREATE INDEX IF NOT EXISTS idx_conversations_status           ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created  ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id         ON messages (wa_message_id);
