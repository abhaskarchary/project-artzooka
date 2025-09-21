-- Switch players.avatar from jsonb to text to avoid cast errors during inserts
ALTER TABLE players
    ALTER COLUMN avatar TYPE TEXT USING avatar::text;


