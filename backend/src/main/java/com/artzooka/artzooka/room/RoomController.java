package com.artzooka.artzooka.room;

import com.artzooka.artzooka.player.Player;
import com.artzooka.artzooka.player.PlayerRepository;
import com.artzooka.artzooka.prompt.PromptPair;
import com.artzooka.artzooka.prompt.PromptPairRepository;
import com.artzooka.artzooka.game.Game;
import com.artzooka.artzooka.game.GameRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.*;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {
    private final RoomService roomService;
    private final PlayerRepository playerRepository;
    private final GameRepository gameRepository;
    private final PromptPairRepository promptPairRepository;
    private final SimpMessagingTemplate messagingTemplate;
private static final SecureRandom RANDOM = new SecureRandom();

    public RoomController(RoomService roomService, PlayerRepository playerRepository, GameRepository gameRepository, PromptPairRepository promptPairRepository, SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.playerRepository = playerRepository;
        this.gameRepository = gameRepository;
        this.promptPairRepository = promptPairRepository;
        this.messagingTemplate = messagingTemplate;
    }

@PostMapping
public ResponseEntity<?> createRoom() {
Room room = roomService.createRoom();
System.out.println("[ARTZOOKA] Room created code=" + room.getCode());
return ResponseEntity.ok(Map.of("id", room.getId(), "code", room.getCode(), "status", room.getStatus()));
}

@PostMapping("/{code}/join")
@Transactional
public ResponseEntity<?> joinRoom(@PathVariable String code, @RequestBody Map<String, Object> body) {
Optional<Room> roomOpt = roomService.findByCode(code);
if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
Room room = roomOpt.get();

        // enforce capacity: max 8 players
        long current = playerRepository.countByRoom_Id(room.getId());
        if (current >= 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Room is full (max 8 players)"));
        }

Player player = new Player();
player.setRoom(room);
        player.setName(String.valueOf(body.getOrDefault("name", "Player" + RANDOM.nextInt(1000))));
        boolean isFirst = current == 0;
player.setAdmin(isFirst);
        // assign session token on join
        player.setSessionToken(java.util.UUID.randomUUID().toString());
playerRepository.save(player);

        // broadcast lobby update (no sensitive info)
        Map<String, Object> playerDto = new java.util.LinkedHashMap<>();
        playerDto.put("id", player.getId());
        playerDto.put("name", player.getName());
        playerDto.put("isAdmin", player.isAdmin());
        playerDto.put("avatar", player.getAvatar());

        Map<String, Object> lobbyEvent = new java.util.LinkedHashMap<>();
        lobbyEvent.put("type", "PLAYER_JOINED");
        lobbyEvent.put("roomCode", room.getCode());
        lobbyEvent.put("player", playerDto);
        messagingTemplate.convertAndSend("/topic/rooms/" + room.getCode(), lobbyEvent);

        System.out.println("[ARTZOOKA] Player joined room=" + room.getCode() + " name=" + player.getName());
        return ResponseEntity.ok(Map.of(
                "playerId", player.getId(),
                "isAdmin", player.isAdmin(),
                "sessionToken", player.getSessionToken()
        ));
}

@PostMapping("/{code}/start")
@Transactional
    public ResponseEntity<?> startGame(@PathVariable String code) {
Optional<Room> roomOpt = roomService.findByCode(code);
if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
Room room = roomOpt.get();
        List<Player> players = playerRepository.findByRoom_Id(room.getId());
if (players.size() < 3) return ResponseEntity.badRequest().body(Map.of("error", "Need at least 3 players"));
        // pre-start countdown (synced)
        long now = System.currentTimeMillis();
        int countdownSeconds = 3;
        long startAt = now + 800; // small buffer so everyone sees the first number
        Map<String, Object> pre = Map.of(
                "type", "GAME_COUNTDOWN",
                "roomCode", room.getCode(),
                "startAt", startAt,
                "seconds", countdownSeconds
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + room.getCode(), pre);

List<PromptPair> pairs = promptPairRepository.findAll();
if (pairs.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No prompts available"));
PromptPair pair = pairs.get(RANDOM.nextInt(pairs.size()));

Player imposter = players.get(RANDOM.nextInt(players.size()));
Game game = new Game();
game.setRoom(room);
game.setImposter(imposter);
game.setPromptCommon(pair.getCommonPrompt());
game.setPromptImposter(pair.getImposterPrompt());
gameRepository.save(game);

        // broadcast game start to lobby without revealing imposter
        long serverTime = startAt + countdownSeconds * 1000L;
        int drawSeconds = room.getDrawSeconds();
        int voteSeconds = room.getVoteSeconds();
        long voteStartTime = serverTime + drawSeconds * 1000L;
        Map<String, Object> startEvent = new java.util.LinkedHashMap<>();
        startEvent.put("type", "GAME_STARTED");
        startEvent.put("roomCode", room.getCode());
        startEvent.put("gameId", game.getId());
        startEvent.put("promptCommon", pair.getCommonPrompt());
        startEvent.put("serverTime", serverTime);
        startEvent.put("drawSeconds", drawSeconds);
        startEvent.put("voteSeconds", voteSeconds);
        startEvent.put("voteStartTime", voteStartTime);
        messagingTemplate.convertAndSend("/topic/rooms/" + room.getCode(), startEvent);

        // do not expose imposterId or imposter prompt in this response
        return ResponseEntity.ok(Map.of(
                "gameId", game.getId(),
                "roomId", room.getId(),
                "promptCommon", pair.getCommonPrompt()
        ));
}

    @GetMapping("/{code}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getRoomState(@PathVariable String code) {
        Optional<Room> roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        Room room = roomOpt.get();
        List<Player> players = playerRepository.findByRoom_Id(room.getId());
        List<Map<String, Object>> playerDtos = new ArrayList<>();
        for (Player p : players) {
            java.util.Map<String, Object> dto = new java.util.LinkedHashMap<>();
            dto.put("id", p.getId());
            dto.put("name", p.getName());
            dto.put("isAdmin", p.isAdmin());
            dto.put("avatar", p.getAvatar());
            playerDtos.add(dto);
        }
        return ResponseEntity.ok(Map.of(
                "id", room.getId(),
                "code", room.getCode(),
                "status", room.getStatus(),
                "players", playerDtos,
                "drawSeconds", room.getDrawSeconds(),
                "voteSeconds", room.getVoteSeconds(),
                "maxPlayers", room.getMaxPlayers()
        ));
    }

    @PostMapping("/{code}/settings")
    @Transactional
    public ResponseEntity<?> updateSettings(@PathVariable String code, @RequestParam("token") String token, @RequestBody Map<String, Object> body) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        Room room = roomOpt.get();
        var adminOpt = playerRepository.findBySessionToken(token);
        if (adminOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        var admin = adminOpt.get();
        if (!admin.isAdmin() || !admin.getRoom().getId().equals(room.getId())) return ResponseEntity.status(403).body(Map.of("error","Only host can edit"));

        Integer draw = (Integer) body.getOrDefault("drawSeconds", room.getDrawSeconds());
        Integer vote = (Integer) body.getOrDefault("voteSeconds", room.getVoteSeconds());
        // max players is fixed at 8
        Integer maxP = 8;
        // clamp values
        draw = Math.max(15, Math.min(300, draw));
        vote = Math.max(15, Math.min(180, vote));
        maxP = Math.max(2, Math.min(16, maxP));
        room.setDrawSeconds(draw);
        room.setVoteSeconds(vote);
        room.setMaxPlayers(8);

        // push to lobby subscribers
        Map<String, Object> evt = Map.of(
                "type", "SETTINGS_UPDATED",
                "roomCode", code,
                "drawSeconds", draw,
                "voteSeconds", vote,
                "maxPlayers", 8
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + code, evt);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/{code}/leave")
    @Transactional
    public ResponseEntity<?> leaveRoom(@PathVariable String code, @RequestParam("token") String token) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        var playerOpt = playerRepository.findBySessionToken(token);
        if (playerOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player player = playerOpt.get();
        if (!player.getRoom().getId().equals(roomOpt.get().getId())) return ResponseEntity.status(403).body(Map.of("error", "Token not for this room"));

        boolean wasAdmin = player.isAdmin();
        playerRepository.delete(player);

        // reassign admin if needed
        if (wasAdmin) {
            var remaining = playerRepository.findByRoom_Id(roomOpt.get().getId());
            if (!remaining.isEmpty()) {
                remaining.get(0).setAdmin(true);
                playerRepository.save(remaining.get(0));
            }
        }

        Map<String, Object> evt = Map.of(
                "type", "PLAYER_LEFT",
                "roomCode", code,
                "playerId", player.getId()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + code, evt);
        System.out.println("[ARTZOOKA] Player left room=" + code + " name=" + player.getName());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @DeleteMapping("/{code}/players/{playerId}")
    @Transactional
    public ResponseEntity<?> kickPlayer(@PathVariable String code, @PathVariable UUID playerId, @RequestParam("token") String token) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        var adminOpt = playerRepository.findBySessionToken(token);
        if (adminOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player admin = adminOpt.get();
        if (!admin.getRoom().getId().equals(roomOpt.get().getId())) return ResponseEntity.status(403).body(Map.of("error", "Token not for this room"));
        if (!admin.isAdmin()) return ResponseEntity.status(403).body(Map.of("error", "Only host can kick"));

        var targetOpt = playerRepository.findById(playerId);
        if (targetOpt.isEmpty()) return ResponseEntity.notFound().build();
        Player target = targetOpt.get();
        if (!target.getRoom().getId().equals(roomOpt.get().getId())) return ResponseEntity.status(400).body(Map.of("error", "Player not in this room"));

        boolean wasAdmin = target.isAdmin();
        playerRepository.delete(target);

        if (wasAdmin) {
            var remaining = playerRepository.findByRoom_Id(roomOpt.get().getId());
            if (!remaining.isEmpty()) {
                remaining.get(0).setAdmin(true);
                playerRepository.save(remaining.get(0));
            }
        }

        Map<String, Object> evt = Map.of(
                "type", "PLAYER_LEFT",
                "roomCode", code,
                "playerId", target.getId()
        );
        messagingTemplate.convertAndSend("/topic/rooms/" + code, evt);
        System.out.println("[ARTZOOKA] Player kicked room=" + code + " name=" + target.getName());
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/{code}/prompt")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getPlayerPrompt(@PathVariable String code, @RequestParam("token") String token) {
        Optional<Room> roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        Room room = roomOpt.get();

        var playerOpt = playerRepository.findBySessionToken(token);
        if (playerOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player player = playerOpt.get();
        if (!player.getRoom().getId().equals(room.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Token not for this room"));
        }

        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(room.getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);

        String prompt = player.getId().equals(game.getImposter().getId()) ? game.getPromptImposter() : game.getPromptCommon();
        return ResponseEntity.ok(Map.of(
                "gameId", game.getId(),
                "prompt", prompt
        ));
    }
}
