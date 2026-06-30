package br.com.atelier.tutorial;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TutorialRepository extends JpaRepository<Tutorial, String> {

    List<Tutorial> findAllByOrderByCreatedAtDesc();
}
