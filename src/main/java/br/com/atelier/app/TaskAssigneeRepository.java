package br.com.atelier.app;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, Long> {
    List<TaskAssignee> findByTaskIdIn(List<String> taskIds);
    void deleteByTaskId(String taskId);
}
