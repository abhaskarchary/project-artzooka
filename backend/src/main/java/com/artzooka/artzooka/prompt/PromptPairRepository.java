package com.artzooka.artzooka.prompt;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface PromptPairRepository extends JpaRepository<PromptPair, UUID> { }
