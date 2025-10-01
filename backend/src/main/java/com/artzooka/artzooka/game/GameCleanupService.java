package com.artzooka.artzooka.game;

import com.artzooka.artzooka.room.Room;
import com.artzooka.artzooka.room.RoomService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Service
public class GameCleanupService {
    private final GameRepository gameRepository;
    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;

    public GameCleanupService(GameRepository gameRepository, RoomService roomService, SimpMessagingTemplate messagingTemplate) {
        this.gameRepository = gameRepository;
        this.roomService = roomService;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedRate = 30000) // Run every 30 seconds
    @Transactional
    public void cleanupExpiredGames() {
        // Find games that have been running for too long (e.g., more than 10 minutes)
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(10);
        
        List<Game> expiredGames = gameRepository.findByCreatedAtBeforeAndStatusNot(cutoff, "COMPLETED");
        
        for (Game game : expiredGames) {
            Room room = game.getRoom();
            if (room.getStatus().equals("DRAWING") || room.getStatus().equals("VOTING") || room.getStatus().equals("RESULTS")) {
                System.out.println("[ARTZOOKA] Auto-ending expired game in room: " + room.getCode());
                
                // Reset room status back to LOBBY
                room.setStatus("LOBBY");
                roomService.save(room);
                
                // Mark game as completed
                game.setStatus("COMPLETED");
                gameRepository.save(game);
                
                // Broadcast that the game has ended
                Map<String, Object> gameEndedEvent = Map.of(
                        "type", "GAME_ENDED",
                        "roomCode", room.getCode(),
                        "reason", "Game timer expired"
                );
                messagingTemplate.convertAndSend("/topic/rooms/" + room.getCode(), gameEndedEvent);
            }
        }
    }
}



