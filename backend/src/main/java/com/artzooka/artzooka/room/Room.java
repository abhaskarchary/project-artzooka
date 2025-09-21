package com.artzooka.artzooka.room;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "rooms")
public class Room {
@Id
@GeneratedValue
private UUID id;

@Column(nullable = false, unique = true, length = 12)
private String code;

@Column(nullable = false, length = 20)
private String status = "LOBBY";

@Column(name = "created_at", nullable = false)
private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "draw_seconds", nullable = false)
    private int drawSeconds = 120;

    @Column(name = "vote_seconds", nullable = false)
    private int voteSeconds = 60;

    @Column(name = "max_players", nullable = false)
    private int maxPlayers = 8;

public UUID getId() { return id; }
public String getCode() { return code; }
public String getStatus() { return status; }
public OffsetDateTime getCreatedAt() { return createdAt; }
public int getDrawSeconds() { return drawSeconds; }
public int getVoteSeconds() { return voteSeconds; }
public int getMaxPlayers() { return maxPlayers; }

public void setCode(String code) { this.code = code; }
public void setStatus(String status) { this.status = status; }
public void setDrawSeconds(int drawSeconds) { this.drawSeconds = drawSeconds; }
public void setVoteSeconds(int voteSeconds) { this.voteSeconds = voteSeconds; }
public void setMaxPlayers(int maxPlayers) { this.maxPlayers = maxPlayers; }
}
