package br.com.atelier.note;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class NoteService {

    private final NoteRepository repository;

    public NoteService(NoteRepository repository) {
        this.repository = repository;
    }

    public List<Note> list(Boolean individual) {
        if (individual != null) {
            return repository.findByIndividualOrderByCreatedAtDesc(individual);
        }
        return repository.findAll();
    }

    public Note get(Long id) {
        return repository.findById(id).orElseThrow();
    }

    public Note save(Note note) {
        return repository.save(note);
    }

    public Note update(Long id, Note note) {
        note.setId(id);
        return repository.save(note);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }
}
