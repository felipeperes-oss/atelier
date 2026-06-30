package br.com.atelier.task;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "task_assignee")
public class TaskAssignee {

    @EmbeddedId
    private TaskAssigneeId id;

    public TaskAssignee() {
    }

    public TaskAssignee(String taskId, String userId) {
        this.id = new TaskAssigneeId(taskId, userId);
    }

    public TaskAssigneeId getId() {
        return id;
    }

    public void setId(TaskAssigneeId id) {
        this.id = id;
    }

    public String getTaskId() {
        return id != null ? id.getTaskId() : null;
    }

    public String getUserId() {
        return id != null ? id.getUserId() : null;
    }
}
