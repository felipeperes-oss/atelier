package br.com.atelier.user;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileRepository extends JpaRepository<Profile, String> {

    List<Profile> findAllByOrderByDisplayNameAsc();
}
