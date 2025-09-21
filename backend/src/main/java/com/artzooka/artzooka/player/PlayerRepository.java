package com.artzooka.artzooka.player;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlayerRepository extends JpaRepository<Player, UUID> {
List<Player> findByRoom_Id(UUID roomId);
long countByRoom_Id(UUID roomId);
Optional<Player> findBySessionToken(String sessionToken);
}
