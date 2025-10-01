package com.artzooka.artzooka.drawing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.UUID;

public interface DrawingRepository extends JpaRepository<Drawing, UUID> {
    List<Drawing> findByGame_Id(UUID gameId);
    boolean existsByGame_IdAndPlayer_Id(UUID gameId, UUID playerId);
    long countByGame_Id(UUID gameId);
    
    @Query("SELECT COUNT(DISTINCT d.player.id) FROM Drawing d WHERE d.game.id = ?1")
    long countDistinctPlayersByGame_Id(UUID gameId);
    
    Drawing findFirstByGame_IdAndPlayer_Id(UUID gameId, UUID playerId);
    void deleteByGame_IdAndPlayer_Id(UUID gameId, UUID playerId);
}
