package br.com.atelier.app;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AppFileRepository extends JpaRepository<AppFile, String> {
}
