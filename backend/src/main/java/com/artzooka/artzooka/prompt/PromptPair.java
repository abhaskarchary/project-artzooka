package com.artzooka.artzooka.prompt;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "prompt_pairs")
public class PromptPair {
@Id
@GeneratedValue
private UUID id;

@Column(name = "common_prompt", nullable = false)
private String commonPrompt;

@Column(name = "imposter_prompt", nullable = false)
private String imposterPrompt;

public UUID getId() { return id; }
public String getCommonPrompt() { return commonPrompt; }
public String getImposterPrompt() { return imposterPrompt; }

public void setCommonPrompt(String commonPrompt) { this.commonPrompt = commonPrompt; }
public void setImposterPrompt(String imposterPrompt) { this.imposterPrompt = imposterPrompt; }
}
