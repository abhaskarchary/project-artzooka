-- Normalize column names in votes table if created with *_player_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'votes' AND column_name = 'voter_player_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'votes' AND column_name = 'voter_id'
    ) THEN
        ALTER TABLE votes RENAME COLUMN voter_player_id TO voter_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'votes' AND column_name = 'target_player_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'votes' AND column_name = 'target_id'
    ) THEN
        ALTER TABLE votes RENAME COLUMN target_player_id TO target_id;
    END IF;
END $$;


