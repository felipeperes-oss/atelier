package br.com.atelier.tutorial;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class TutorialService {

    private final TutorialRepository repository;

    public TutorialService(TutorialRepository repository) {
        this.repository = repository;
    }

    public List<Tutorial> list() {
        return repository.findAll();
    }

    public Tutorial get(Long id) {
        return repository.findById(id).orElseThrow();
    }

    public Tutorial save(Tutorial tutorial) {
        return repository.save(tutorial);
    }

    public Tutorial update(Long id, Tutorial tutorial) {
        tutorial.setId(id);
        return repository.save(tutorial);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }
}
