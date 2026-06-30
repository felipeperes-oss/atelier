package br.com.atelier.note;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NoteRepository extends JpaRepository<Note, String> {

    List<Note> findByScopeOrderByUpdatedAtDesc(String scope);

    List<Note> findByUserIdOrderByUpdatedAtDesc(String userId);

    List<Note> findByScopeAndUserIdOrderByUpdatedAtDesc(String scope, String userId);

    List<Note> findAllByOrderByUpdatedAtDesc();
}
