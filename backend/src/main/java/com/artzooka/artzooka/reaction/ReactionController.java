package com.artzooka.artzooka.reaction;

import com.artzooka.artzooka.game.Game;
import com.artzooka.artzooka.game.GameRepository;
import com.artzooka.artzooka.player.Player;
import com.artzooka.artzooka.player.PlayerRepository;
import com.artzooka.artzooka.room.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms/{code}/reactions")
@CrossOrigin(origins = "*")
public class ReactionController {
    private final RoomService roomService;
    private final PlayerRepository playerRepository;
    private final GameRepository gameRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ReactionController(RoomService roomService, PlayerRepository playerRepository, GameRepository gameRepository, SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.playerRepository = playerRepository;
        this.gameRepository = gameRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> react(@PathVariable String code,
                                   @RequestParam("token") String token,
                                   @RequestParam("targetId") UUID targetId,
                                   @RequestParam("emoji") String emoji) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        var playerOpt = playerRepository.findBySessionToken(token);
        if (playerOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player reactor = playerOpt.get();
        if (!reactor.getRoom().getId().equals(roomOpt.get().getId())) return ResponseEntity.status(403).body(Map.of("error", "Token not for this room"));

        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);

        // ensure target belongs to room
        var targetOpt = playerRepository.findById(targetId);
        if (targetOpt.isEmpty() || !targetOpt.get().getRoom().getId().equals(roomOpt.get().getId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid target"));
        }

        // broadcast lightweight reaction event
        Map<String, Object> evt = Map.of(
                "type", "REACTION",
                "roomCode", code,
                "gameId", game.getId(),
                "targetId", targetId,
                "emoji", emoji
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + code, evt);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}


