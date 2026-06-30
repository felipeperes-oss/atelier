package br.com.atelier.team;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class TeamMemberService {

    private final TeamMemberRepository repository;

    public TeamMemberService(TeamMemberRepository repository) {
        this.repository = repository;
    }

    public List<TeamMember> list() {
        // SQLRestriction handles filtering active=true automatically
        return repository.findAll();
    }

    public TeamMember get(Long id) {
        return repository.findById(id).orElseThrow();
    }

    public TeamMember save(TeamMember member) {
        return repository.save(member);
    }

    public TeamMember update(Long id, TeamMember member) {
        member.setId(id);
        return repository.save(member);
    }

    public void delete(Long id) {
        // deleteById triggers SQLDelete UPDATE query automatically
        repository.deleteById(id);
    }
}
