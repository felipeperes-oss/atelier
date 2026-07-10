package br.com.atelier.alert;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class AlertService {

    private final AlertRepository repository;

    public AlertService(AlertRepository repository) {
        this.repository = repository;
    }

    public List<Alert> list(Boolean read) {
        if (read != null) {
            return repository.findByReadOrderByDueDateAsc(read);
        }
        return repository.findAll();
    }

    public Alert get(Long id) {
        return repository.findById(id).orElseThrow();
    }

    public Alert save(Alert alert) {
        return repository.save(alert);
    }

    public Alert update(Long id, Alert alert) {
        alert.setId(id);
        return repository.save(alert);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }
}
