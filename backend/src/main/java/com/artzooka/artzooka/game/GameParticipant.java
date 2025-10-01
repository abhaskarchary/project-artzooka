package com.artzooka.artzooka.game;

import com.artzooka.artzooka.player.Player;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "game_participants")
public class GameParticipant {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "joined_at", nullable = false)
    private OffsetDateTime joinedAt = OffsetDateTime.now();

    @Column(name = "left_at")
    private OffsetDateTime leftAt;

    public UUID getId() { return id; }
    public Game getGame() { return game; }
    public Player getPlayer() { return player; }
    public boolean isActive() { return active; }
    public OffsetDateTime getJoinedAt() { return joinedAt; }
    public OffsetDateTime getLeftAt() { return leftAt; }

    public void setGame(Game game) { this.game = game; }
    public void setPlayer(Player player) { this.player = player; }
    public void setActive(boolean active) { this.active = active; }
    public void setLeftAt(OffsetDateTime leftAt) { this.leftAt = leftAt; }
}



