package com.artzooka.artzooka.player;

import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/player")
@CrossOrigin(origins = "*")
public class PlayerController {
    private final PlayerRepository playerRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public PlayerController(PlayerRepository playerRepository, SimpMessagingTemplate messagingTemplate) {
        this.playerRepository = playerRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/avatar")
    @Transactional
    public ResponseEntity<?> updateAvatar(@RequestParam("token") String token, @RequestBody Map<String, Object> body) {
        var playerOpt = playerRepository.findBySessionToken(token);
        if (playerOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player player = playerOpt.get();
        String avatar = String.valueOf(body.getOrDefault("avatar", ""));
        player.setAvatar(avatar);
        playerRepository.save(player);

        // broadcast to room
        if (player.getRoom() != null) {
            Map<String, Object> evt = Map.of(
                    "type", "AVATAR_UPDATED",
                    "roomCode", player.getRoom().getCode(),
                    "player", Map.of(
                            "id", player.getId(),
                            "name", player.getName(),
                            "isAdmin", player.isAdmin(),
                            "avatar", player.getAvatar()
                    )
            );
            messagingTemplate.convertAndSend("/topic/rooms/" + player.getRoom().getCode(), evt);
        }

        return ResponseEntity.ok(Map.of("ok", true));
    }
}
