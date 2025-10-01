-- Create game_participants table to track active players in games
CREATE TABLE game_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(game_id, player_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_game_participants_game_active ON game_participants(game_id, active);
CREATE INDEX idx_game_participants_player ON game_participants(player_id);



