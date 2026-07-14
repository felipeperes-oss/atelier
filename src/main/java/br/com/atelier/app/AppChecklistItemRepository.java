package br.com.atelier.app;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppChecklistItemRepository extends JpaRepository<AppChecklistItem, String> {
    List<AppChecklistItem> findByChecklistIdInOrderByPositionAscCreatedAtAsc(List<String> checklistIds);
    void deleteByChecklistId(String checklistId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from AppChecklistItem item where item.id = :id")
    Optional<AppChecklistItem> findLockedById(@Param("id") String id);
}
