package br.com.atelier.alert;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, String> {

    List<Alert> findByReadOrderByCreatedAtDesc(boolean read);

    List<Alert> findAllByOrderByCreatedAtDesc();
}
