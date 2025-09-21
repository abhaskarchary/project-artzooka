package com.artzooka.artzooka.drawing;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface DrawingRepository extends JpaRepository<Drawing, UUID> {
    List<Drawing> findByGame_Id(UUID gameId);
    boolean existsByGame_IdAndPlayer_Id(UUID gameId, UUID playerId);
    long countByGame_Id(UUID gameId);
}
