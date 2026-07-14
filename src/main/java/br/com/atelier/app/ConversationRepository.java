package br.com.atelier.app;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, String> {
    List<Conversation> findByParticipantIdsContainingOrderByCreatedAtDesc(String userId);
}
