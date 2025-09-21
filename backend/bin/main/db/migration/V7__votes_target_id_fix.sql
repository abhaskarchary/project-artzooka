-- Ensure votes.target_id column exists and is NOT NULL with FK
ALTER TABLE votes ADD COLUMN IF NOT EXISTS target_id UUID;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'votes' AND tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_name = 'fk_votes_target'
    ) THEN
        ALTER TABLE votes ADD CONSTRAINT fk_votes_target FOREIGN KEY (target_id) REFERENCES players(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Make NOT NULL only if there are no NULLs (dev-friendly)
DO $$
DECLARE
    has_nulls boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM votes WHERE target_id IS NULL) INTO has_nulls;
    IF NOT has_nulls THEN
        ALTER TABLE votes ALTER COLUMN target_id SET NOT NULL;
    END IF;
END $$;


