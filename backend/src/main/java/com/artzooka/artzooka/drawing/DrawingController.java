package com.artzooka.artzooka.drawing;

import com.artzooka.artzooka.game.Game;
import com.artzooka.artzooka.game.GameRepository;
import com.artzooka.artzooka.player.Player;
import com.artzooka.artzooka.player.PlayerRepository;
import com.artzooka.artzooka.room.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;

@RestController
@RequestMapping("/api/rooms/{code}/drawings")
@CrossOrigin(origins = "*")
public class DrawingController {
    private final RoomService roomService;
    private final PlayerRepository playerRepository;
    private final GameRepository gameRepository;
    private final DrawingRepository drawingRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public DrawingController(RoomService roomService, PlayerRepository playerRepository, GameRepository gameRepository, DrawingRepository drawingRepository, SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.playerRepository = playerRepository;
        this.gameRepository = gameRepository;
        this.drawingRepository = drawingRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> uploadDrawing(@PathVariable String code, @RequestParam("token") String token, @RequestParam("file") MultipartFile file) throws IOException {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        var playerOpt = playerRepository.findBySessionToken(token);
        if (playerOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player player = playerOpt.get();
        if (!player.getRoom().getId().equals(roomOpt.get().getId())) return ResponseEntity.status(403).body(Map.of("error", "Token not for this room"));

        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);

        Path uploadsRoot = Path.of("uploads");
        Path relativeDir = Path.of(code, game.getId().toString());
        Path absoluteDir = uploadsRoot.resolve(relativeDir);
        Files.createDirectories(absoluteDir);
        String filename = player.getId() + "_" + Objects.requireNonNullElse(file.getOriginalFilename(), "drawing.png");
        Path dest = absoluteDir.resolve(filename);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

        Drawing existing = drawingRepository.findFirstByGame_IdAndPlayer_Id(game.getId(), player.getId());
        if (existing == null) {
            existing = new Drawing();
            existing.setGame(game);
            existing.setPlayer(player);
        }
        // store relative path under uploads root so URLs can be /static/{relative}
        existing.setFilePath(relativeDir.resolve(filename).toString());
        drawingRepository.save(existing);
        // notify room subscribers to refresh gallery
        Map<String, Object> evt = Map.of(
            "type", "DRAWING_UPLOADED",
            "roomCode", code,
            "gameId", game.getId(),
            "playerId", player.getId()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + code, evt);
        System.out.println("[ARTZOOKA] Drawing uploaded room=" + code + " player=" + player.getName());

        // If all players submitted at least once, broadcast DISCUSS_STARTED to move everyone to voting
        int submitted = (int) drawingRepository.countByGame_Id(game.getId());
        int totalPlayers = (int) playerRepository.countByRoom_Id(roomOpt.get().getId());
        if (totalPlayers > 0 && submitted >= totalPlayers) {
            Map<String, Object> discuss = new java.util.LinkedHashMap<>();
            discuss.put("type", "DISCUSS_STARTED");
            discuss.put("roomCode", code);
            discuss.put("serverTime", System.currentTimeMillis());
            discuss.put("voteSeconds", 60);
            messagingTemplate.convertAndSend("/topic/rooms/" + code, discuss);
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @DeleteMapping
    @Transactional
    public ResponseEntity<?> unsubmitDrawing(@PathVariable String code, @RequestParam("token") String token) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        var playerOpt = playerRepository.findBySessionToken(token);
        if (playerOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player player = playerOpt.get();
        if (!player.getRoom().getId().equals(roomOpt.get().getId())) return ResponseEntity.status(403).body(Map.of("error", "Token not for this room"));
        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);

        drawingRepository.deleteByGame_IdAndPlayer_Id(game.getId(), player.getId());

        Map<String, Object> evt = Map.of(
                "type", "DRAWING_UPLOADED",
                "roomCode", code,
                "gameId", game.getId(),
                "playerId", player.getId()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + code, evt);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> listDrawings(@PathVariable String code) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);
        var list = new ArrayList<Map<String,Object>>();
        for (Drawing d : drawingRepository.findByGame_Id(game.getId())) {
            String relative = Path.of(d.getFilePath()).toString();
            if (relative.startsWith("uploads/")) {
                relative = relative.substring("uploads/".length());
            }
            String absoluteUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/static/")
                .path(relative)
                .toUriString();
            list.add(Map.of(
                "playerId", d.getPlayer().getId(),
                "filePath", absoluteUrl
            ));
        }
        return ResponseEntity.ok(list);
    }
}
