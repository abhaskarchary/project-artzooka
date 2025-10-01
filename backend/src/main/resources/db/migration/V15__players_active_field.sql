-- Add active field for soft deletion of players (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'players' AND column_name = 'active') THEN
        ALTER TABLE players ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
END $$;

-- Create index for active players queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_players_room_active ON players(room_id, active);



