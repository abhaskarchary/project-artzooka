package com.artzooka.artzooka.game;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface GameParticipantRepository extends JpaRepository<GameParticipant, UUID> {
    List<GameParticipant> findByGame_IdAndActiveTrue(UUID gameId);
    long countByGame_IdAndActiveTrue(UUID gameId);
    GameParticipant findByGame_IdAndPlayer_Id(UUID gameId, UUID playerId);
}



