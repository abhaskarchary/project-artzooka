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
return ResponseEntity.ok(Map.of("id", room.getId(), "code", room.getCode(), "status", room.getStatus()));
}

@PostMapping("/{code}/join")
@Transactional
public ResponseEntity<?> joinRoom(@PathVariable String code, @RequestBody Map<String, Object> body) {
Optional<Room> roomOpt = roomService.findByCode(code);
if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
Room room = roomOpt.get();

Player player = new Player();
player.setRoom(room);
        player.setName(String.valueOf(body.getOrDefault("name", "Player" + RANDOM.nextInt(1000))));
        boolean isFirst = playerRepository.countByRoom_Id(room.getId()) == 0;
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
        Map<String, Object> startEvent = Map.of(
                "type", "GAME_STARTED",
                "roomCode", room.getCode(),
                "gameId", game.getId(),
                "promptCommon", pair.getCommonPrompt()
        );
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
                "players", playerDtos
        ));
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
