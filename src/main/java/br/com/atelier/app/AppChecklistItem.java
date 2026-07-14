package br.com.atelier.app;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_checklist_items")
public class AppChecklistItem {

    @Id
    private String id;

    @JsonProperty("checklist_id")
    @Column(name = "checklist_id", nullable = false)
    private String checklistId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private boolean done;

    @JsonProperty("completed_by")
    @Column(name = "completed_by")
    private String completedBy;

    @JsonProperty("completed_at")
    @Column(name = "completed_at")
    private String completedAt;

    @Column(nullable = false)
    private int position;

    @JsonProperty("created_at")
    @Column(name = "created_at", nullable = false)
    private String createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getChecklistId() {
        return checklistId;
    }

    public void setChecklistId(String checklistId) {
        this.checklistId = checklistId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public boolean isDone() {
        return done;
    }

    public void setDone(boolean done) {
        this.done = done;
    }

    public String getCompletedBy() {
        return completedBy;
    }

    public void setCompletedBy(String completedBy) {
        this.completedBy = completedBy;
    }

    public String getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(String completedAt) {
        this.completedAt = completedAt;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
