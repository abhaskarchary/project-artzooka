package com.artzooka.artzooka.vote;

import com.artzooka.artzooka.game.Game;
import com.artzooka.artzooka.game.GameRepository;
import com.artzooka.artzooka.game.GameParticipantRepository;
import com.artzooka.artzooka.player.Player;
import com.artzooka.artzooka.player.PlayerRepository;
import com.artzooka.artzooka.room.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/rooms/{code}/votes")
@CrossOrigin(origins = "*")
public class VoteController {
    private final RoomService roomService;
    private final PlayerRepository playerRepository;
    private final GameRepository gameRepository;
    private final GameParticipantRepository gameParticipantRepository;
    private final VoteRepository voteRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public VoteController(RoomService roomService, PlayerRepository playerRepository, GameRepository gameRepository, GameParticipantRepository gameParticipantRepository, VoteRepository voteRepository, SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.playerRepository = playerRepository;
        this.gameRepository = gameRepository;
        this.gameParticipantRepository = gameParticipantRepository;
        this.voteRepository = voteRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> castVote(@PathVariable String code, @RequestParam("token") String token, @RequestParam("targetId") UUID targetId) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        var playerOpt = playerRepository.findBySessionToken(token);
        if (playerOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        Player voter = playerOpt.get();
        if (!voter.getRoom().getId().equals(roomOpt.get().getId())) return ResponseEntity.status(403).body(Map.of("error", "Token not for this room"));

        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);
        if (voteRepository.existsByGame_IdAndVoter_Id(game.getId(), voter.getId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Already voted"));
        }
        Player target = playerRepository.findById(targetId).orElse(null);
        if (target == null) return ResponseEntity.badRequest().body(Map.of("error", "Invalid target"));

        Vote v = new Vote();
        v.setGame(game);
        v.setVoter(voter);
        v.setTarget(target);
        voteRepository.save(v);
        System.out.println("[ARTZOOKA] Vote cast voter=" + voter.getName() + " -> target=" + target.getName());
        // broadcast updated tally to everyone in room
        Map<String, Long> counts = new java.util.HashMap<>();
        for (Vote each : voteRepository.findByGame_Id(game.getId())) {
            counts.merge(each.getTarget().getId().toString(), 1L, Long::sum);
        }
        Map<String, Object> evt = new java.util.LinkedHashMap<>();
        evt.put("type", "VOTE_UPDATE");
        evt.put("roomCode", roomOpt.get().getCode());
        evt.put("gameId", game.getId());
        evt.put("tally", counts);
        // topic is /topic/rooms/{code}
        messagingTemplate.convertAndSend("/topic/rooms/" + roomOpt.get().getCode(), evt);

        // If all active game participants have voted, auto-finish and broadcast SHOW_RESULTS
        int votesCast = voteRepository.findByGame_Id(game.getId()).size();
        int totalActiveParticipants = (int) gameParticipantRepository.countByGame_IdAndActiveTrue(game.getId());
        if (totalActiveParticipants > 0 && votesCast >= totalActiveParticipants) {
            // Update room status to RESULTS
            var room = roomOpt.get();
            room.setStatus("RESULTS");
            roomService.save(room);
            
            Map<String, Object> show = new java.util.LinkedHashMap<>();
            show.put("type", "SHOW_RESULTS");
            show.put("roomCode", roomOpt.get().getCode());
            show.put("gameId", game.getId());
            messagingTemplate.convertAndSend("/topic/rooms/" + roomOpt.get().getCode(), show);
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/tally")
    @Transactional(readOnly = true)
    public ResponseEntity<?> tally(@PathVariable String code) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);
        Map<UUID, Long> counts = new HashMap<>();
        for (Vote v : voteRepository.findByGame_Id(game.getId())) {
            counts.merge(v.getTarget().getId(), 1L, Long::sum);
        }
        return ResponseEntity.ok(counts);
    }

    @GetMapping("/result")
    @Transactional(readOnly = true)
    public ResponseEntity<?> result(@PathVariable String code) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);
        Map<UUID, Long> counts = new HashMap<>();
        for (Vote v : voteRepository.findByGame_Id(game.getId())) {
            counts.merge(v.getTarget().getId(), 1L, Long::sum);
        }
        UUID votedOut = null;
        long max = -1;
        for (var e : counts.entrySet()) {
            if (e.getValue() > max) { max = e.getValue(); votedOut = e.getKey(); }
        }
        UUID imposterId = game.getImposter().getId();
        String winner = (votedOut != null && votedOut.equals(imposterId)) ? "ARTISTS" : "IMPOSTER";
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("imposterId", imposterId);
        resp.put("votedOutId", votedOut);
        resp.put("winner", winner);
        resp.put("tally", counts);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/finish")
    @Transactional
    public ResponseEntity<?> finish(@PathVariable String code) {
        var roomOpt = roomService.findByCode(code);
        if (roomOpt.isEmpty()) return ResponseEntity.notFound().build();
        List<Game> games = gameRepository.findByRoomIdOrderByCreatedAtDesc(roomOpt.get().getId());
        if (games.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Game not started"));
        Game game = games.get(0);
        
        // Update room status to RESULTS
        var room = roomOpt.get();
        room.setStatus("RESULTS");
        roomService.save(room);
        
        Map<String, Object> evt = new LinkedHashMap<>();
        evt.put("type", "SHOW_RESULTS");
        evt.put("roomCode", code);
        evt.put("gameId", game.getId());
        messagingTemplate.convertAndSend("/topic/rooms/" + code, evt);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
