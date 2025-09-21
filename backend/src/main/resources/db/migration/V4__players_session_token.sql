-- Add session token to players for rejoin and per-player auth
ALTER TABLE players ADD COLUMN IF NOT EXISTS session_token TEXT;
UPDATE players SET session_token = uuid_generate_v4()::text WHERE session_token IS NULL;
ALTER TABLE players ALTER COLUMN session_token SET NOT NULL;
ALTER TABLE players ADD CONSTRAINT uq_players_session_token UNIQUE(session_token);


