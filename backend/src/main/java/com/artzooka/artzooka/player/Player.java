package com.artzooka.artzooka.player;

import com.artzooka.artzooka.room.Room;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "players")
public class Player {
@Id
@GeneratedValue
private UUID id;

@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "room_id", nullable = false)
private Room room;

@Column(nullable = false, length = 50)
private String name;

@Column(name = "is_admin", nullable = false)
private boolean admin;

    // Store as text to avoid jsonb binding issues for now
    @Column(columnDefinition = "text")
private String avatar;

@Column(name = "created_at", nullable = false)
private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "session_token", nullable = false, unique = true)
    private String sessionToken;

    @Column(name = "active", nullable = false)
    private boolean active = true;

public UUID getId() { return id; }
public Room getRoom() { return room; }
public String getName() { return name; }
public boolean isAdmin() { return admin; }
public String getAvatar() { return avatar; }
public OffsetDateTime getCreatedAt() { return createdAt; }
    public String getSessionToken() { return sessionToken; }
    public boolean isActive() { return active; }

public void setRoom(Room room) { this.room = room; }
public void setName(String name) { this.name = name; }
public void setAdmin(boolean admin) { this.admin = admin; }
public void setAvatar(String avatar) { this.avatar = avatar; }
    public void setSessionToken(String sessionToken) { this.sessionToken = sessionToken; }
    public void setActive(boolean active) { this.active = active; }
}
