-- Supports Meta's "user_changed_number" system event: keeps a full audit
-- trail of WhatsApp number changes per conversation, so history is never
-- lost even when a conversation's wa_id is renamed or merged.
-- Additive only — safe to run against the existing production database.

CREATE TABLE IF NOT EXISTS wa_id_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  old_wa_id       TEXT NOT NULL,
  new_wa_id       TEXT NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_id_history_conversation ON wa_id_history (conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_id_history_old_wa_id ON wa_id_history (old_wa_id);
