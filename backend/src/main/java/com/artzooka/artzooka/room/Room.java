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

public UUID getId() { return id; }
public String getCode() { return code; }
public String getStatus() { return status; }
public OffsetDateTime getCreatedAt() { return createdAt; }

public void setCode(String code) { this.code = code; }
public void setStatus(String status) { this.status = status; }
}
