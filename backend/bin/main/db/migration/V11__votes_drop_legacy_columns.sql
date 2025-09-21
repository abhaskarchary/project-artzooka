-- Drop legacy columns if they still exist; we now use voter_id/target_id
ALTER TABLE votes DROP COLUMN IF EXISTS voter_player_id;
ALTER TABLE votes DROP COLUMN IF EXISTS target_player_id;


