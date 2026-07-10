package br.com.atelier.event;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class EventService {

    private final EventRepository repository;

    public EventService(EventRepository repository) {
        this.repository = repository;
    }

    public List<Event> list(LocalDate start, LocalDate end) {
        if (start != null && end != null) {
            return repository.findByEventDateBetweenOrderByEventDateAscTitleAsc(start, end);
        }
        return repository.findAll();
    }

    public Event get(Long id) {
        return repository.findById(id).orElseThrow();
    }

    public Event save(Event event) {
        return repository.save(event);
    }

    public Event update(Long id, Event event) {
        event.setId(id);
        return repository.save(event);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }
}
