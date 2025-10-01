package com.artzooka.artzooka.game;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface GameRepository extends JpaRepository<Game, UUID> {
List<Game> findByRoomIdOrderByCreatedAtDesc(UUID roomId);
List<Game> findByCreatedAtBeforeAndStatusNot(OffsetDateTime cutoff, String status);
}
