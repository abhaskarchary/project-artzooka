package com.artzooka.artzooka.drawing;

import com.artzooka.artzooka.game.Game;
import com.artzooka.artzooka.player.Player;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "drawings", uniqueConstraints = @UniqueConstraint(columnNames = {"game_id", "player_id"}))
public class Drawing {
    @Id @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "submitted_at", nullable = false)
    private OffsetDateTime submittedAt = OffsetDateTime.now();

    public UUID getId() { return id; }
    public Game getGame() { return game; }
    public Player getPlayer() { return player; }
    public String getFilePath() { return filePath; }
    public OffsetDateTime getSubmittedAt() { return submittedAt; }

    public void setGame(Game game) { this.game = game; }
    public void setPlayer(Player player) { this.player = player; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
}
