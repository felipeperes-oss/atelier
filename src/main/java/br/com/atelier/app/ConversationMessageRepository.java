package br.com.atelier.app;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, String> {
    List<ConversationMessage> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    @Modifying
    @Transactional
    void deleteByConversationId(String conversationId);
}
