package com.artzooka.artzooka.game;

import com.artzooka.artzooka.player.Player;
import com.artzooka.artzooka.room.Room;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "games")
public class Game {
@Id
@GeneratedValue
private UUID id;

@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "room_id", nullable = false)
private Room room;

@Column(nullable = false, length = 20)
private String status = "DRAWING";

@Column(name = "round_number", nullable = false)
private int roundNumber = 1;

@Column(name = "prompt_common", nullable = false)
private String promptCommon;

@Column(name = "prompt_imposter", nullable = false)
private String promptImposter;

@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "imposter_player_id", nullable = false)
private Player imposter;

@Column(name = "created_at", nullable = false)
private OffsetDateTime createdAt = OffsetDateTime.now();

public UUID getId() { return id; }
public Room getRoom() { return room; }
public String getStatus() { return status; }
public int getRoundNumber() { return roundNumber; }
public String getPromptCommon() { return promptCommon; }
public String getPromptImposter() { return promptImposter; }
public Player getImposter() { return imposter; }
public OffsetDateTime getCreatedAt() { return createdAt; }

public void setRoom(Room room) { this.room = room; }
public void setStatus(String status) { this.status = status; }
public void setRoundNumber(int roundNumber) { this.roundNumber = roundNumber; }
public void setPromptCommon(String promptCommon) { this.promptCommon = promptCommon; }
public void setPromptImposter(String promptImposter) { this.promptImposter = promptImposter; }
public void setImposter(Player imposter) { this.imposter = imposter; }
}
