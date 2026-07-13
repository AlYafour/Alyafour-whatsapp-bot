-- Adds support for agent-initiated template messages ("New Conversation").
-- Additive only — safe to run against the existing production database.
-- Does not touch 001_init.sql or delete any existing data.

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'unknown', 'template'));

ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_language TEXT;
