package br.com.atelier.task;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, TaskAssigneeId> {

    List<TaskAssignee> findByIdTaskIdIn(List<String> taskIds);

    void deleteByIdTaskId(String taskId);
}
