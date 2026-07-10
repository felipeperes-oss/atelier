package br.com.atelier.alert;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByReadOrderByDueDateAsc(boolean read);
}
