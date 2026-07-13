-- Rich media support: images, video, audio/voice, documents, stickers,
-- locations, contacts, reactions, interactive replies, system events,
-- and contextual (reply-to) references.
-- Additive only — safe to run against the existing production database.
-- Binary media itself is never stored in Postgres; only metadata and a
-- reference to the object-storage location (storage_key / storage_url).

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text', 'image', 'audio', 'voice', 'video', 'document', 'sticker',
    'location', 'contacts', 'reaction', 'interactive', 'template',
    'system', 'unknown', 'unsupported'
  ));

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check
  CHECK (sender_type IN ('customer', 'bot', 'agent', 'system'));

ALTER TABLE messages ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS storage_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS contacts_data JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction_emoji TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reacted_message_wa_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS context_message_wa_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS interactive_data JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS system_data JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_error TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thumbnail_storage_key TEXT;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_status TEXT;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_media_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_media_status_check
  CHECK (media_status IS NULL OR media_status IN ('pending', 'stored', 'failed'));

CREATE INDEX IF NOT EXISTS idx_messages_reacted_message_wa_id ON messages (reacted_message_wa_id);
CREATE INDEX IF NOT EXISTS idx_messages_context_message_wa_id ON messages (context_message_wa_id);
CREATE INDEX IF NOT EXISTS idx_messages_media_status ON messages (media_status) WHERE media_status IS NOT NULL;
