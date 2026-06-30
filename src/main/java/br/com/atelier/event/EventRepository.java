package br.com.atelier.event;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByEventDateBetweenOrderByEventDateAscTitleAsc(LocalDate start, LocalDate end);
}
