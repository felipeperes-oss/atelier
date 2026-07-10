package br.com.atelier.app;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<Task, String> {
    List<Task> findByTaskDateBetweenOrderByTaskDateAscTitleAsc(String start, String end);
    List<Task> findAllByOrderByTaskDateAscTitleAsc();
}
