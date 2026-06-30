package br.com.atelier.task;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<Task, String> {

    List<Task> findByTaskDateBetweenOrderByTaskDateAscTitleAsc(LocalDate start, LocalDate end);

    List<Task> findByScopeOrderByTaskDateAscTitleAsc(String scope);

    List<Task> findByCreatedByOrderByTaskDateAscTitleAsc(String createdBy);

    List<Task> findAllByOrderByTaskDateAscTitleAsc();
}
