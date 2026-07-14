package br.com.atelier.app;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppChecklistRepository extends JpaRepository<AppChecklist, String> {
    List<AppChecklist> findAllByOrderByUpdatedAtDesc();
}
