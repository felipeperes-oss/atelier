package br.com.atelier.app;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppAlertRepository extends JpaRepository<AppAlert, String> {
    List<AppAlert> findAllByOrderByCreatedAtDesc();
}
