-- Ensure votes.voter_id column exists with FK and unique constraint
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'votes' AND tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_name = 'fk_votes_voter'
    ) THEN
        ALTER TABLE votes ADD CONSTRAINT fk_votes_voter FOREIGN KEY (voter_id) REFERENCES players(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
DECLARE
    has_nulls boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM votes WHERE voter_id IS NULL) INTO has_nulls;
    IF NOT has_nulls THEN
        ALTER TABLE votes ALTER COLUMN voter_id SET NOT NULL;
    END IF;
END $$;

-- Unique vote per game per voter
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_votes_game_voter'
    ) THEN
        ALTER TABLE votes ADD CONSTRAINT uq_votes_game_voter UNIQUE (game_id, voter_id);
    END IF;
END $$;


