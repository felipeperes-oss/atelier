package br.com.atelier.app;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

@Entity
@Table(name = "chat_conversations")
public class Conversation {

    @Id
    private String id;

    @JsonProperty("created_by")
    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @JsonProperty("type")
    @Column(nullable = false)
    private String type;

    @JsonProperty("title")
    @Column
    private String title;

    @JsonProperty("participant_ids")
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "chat_conversation_participants", joinColumns = @JoinColumn(name = "conversation_id"))
    @Column(name = "participant_id")
    private List<String> participantIds = new ArrayList<>();

    @JsonProperty("created_at")
    @Column(name = "created_at", nullable = false)
    private String createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<String> getParticipantIds() {
        return participantIds;
    }

    public void setParticipantIds(List<String> participantIds) {
        this.participantIds = participantIds == null ? new ArrayList<>() : participantIds;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
