package com.artzooka.artzooka.vote;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface VoteRepository extends JpaRepository<Vote, UUID> {
    List<Vote> findByGame_Id(UUID gameId);
    boolean existsByGame_IdAndVoter_Id(UUID gameId, UUID voterId);
}
