package br.com.atelier.app;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AppTutorialRepository extends JpaRepository<AppTutorial, String> {
}
