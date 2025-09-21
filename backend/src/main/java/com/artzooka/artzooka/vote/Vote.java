package com.artzooka.artzooka.vote;

import com.artzooka.artzooka.game.Game;
import com.artzooka.artzooka.player.Player;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "votes", uniqueConstraints = @UniqueConstraint(columnNames = {"game_id", "voter_id"}))
public class Vote {
    @Id @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voter_id", nullable = false)
    private Player voter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_id", nullable = false)
    private Player target;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UUID getId() { return id; }
    public Game getGame() { return game; }
    public Player getVoter() { return voter; }
    public Player getTarget() { return target; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public void setGame(Game game) { this.game = game; }
    public void setVoter(Player voter) { this.voter = voter; }
    public void setTarget(Player target) { this.target = target; }
}
