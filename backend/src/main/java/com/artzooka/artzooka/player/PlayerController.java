package com.artzooka.artzooka.player;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/player")
@CrossOrigin(origins = "*")
public class PlayerController {
    private final PlayerRepository playerRepository;

    public PlayerController(PlayerRepository playerRepository) {
        this.playerRepository = playerRepository;
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
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
