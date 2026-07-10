package br.com.atelier.app;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppNoteRepository extends JpaRepository<AppNote, String> {
    List<AppNote> findByScopeAndUserIdOrderByUpdatedAtDesc(String scope, String userId);
    List<AppNote> findByScopeOrderByUpdatedAtDesc(String scope);
    List<AppNote> findByUserIdOrderByUpdatedAtDesc(String userId);
    List<AppNote> findAllByOrderByUpdatedAtDesc();
}
