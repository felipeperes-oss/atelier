package br.com.atelier.config;

import java.time.LocalDate;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import br.com.atelier.alert.Alert;
import br.com.atelier.alert.AlertRepository;
import br.com.atelier.event.Event;
import br.com.atelier.event.EventRepository;
import br.com.atelier.event.EventType;
import br.com.atelier.note.Note;
import br.com.atelier.note.NoteRepository;
import br.com.atelier.team.TeamMember;
import br.com.atelier.team.TeamMemberRepository;
import br.com.atelier.tutorial.Tutorial;
import br.com.atelier.tutorial.TutorialRepository;

@Configuration
public class DataLoader {

    @Bean
    CommandLineRunner loadInitialData(
            EventRepository events,
            TeamMemberRepository members,
            NoteRepository notes,
            TutorialRepository tutorials,
            AlertRepository alerts) {
        return args -> {
            if (events.count() > 0) {
                return;
            }

            addMember(members, "Alessandra", "alessandra@atelier.local", "Equipe");
            addMember(members, "Felipe", "felipe@atelier.local", "Equipe");
            addMember(members, "Lucas", "lucas@atelier.local", "Individual");
            addMember(members, "Herysson", "herysson@atelier.local", "Equipe");

            addEvent(events, "Reuniao de Equipe", LocalDate.of(2026, 6, 9), EventType.TEAM, "Alessandra, Felipe +1");
            addEvent(events, "HC UFMG", LocalDate.of(2026, 6, 15), EventType.INDIVIDUAL, "Lucas");
            addEvent(events, "Master Remoto", LocalDate.of(2026, 6, 19), EventType.TEAM, "Felipe, Alessandra");
            addEvent(events, "Apresentacao", LocalDate.of(2026, 6, 23), EventType.TEAM, "Alessandra, Herysson");

            addNote(notes, "Anotacoes gerais", "Espaco para registrar pontos gerais da equipe.", null, false);
            addNote(notes, "Anotacoes individuais", "Espaco para observacoes individuais.", "Felipe", true);

            addTutorial(tutorials, "Fluxo do calendario", "Cadastrar eventos com data, tipo e participantes.", null);

            addAlert(alerts, "Revisar agenda da semana", "Conferir eventos e responsaveis antes da reuniao.", LocalDate.of(2026, 6, 24));
        };
    }

    private void addMember(TeamMemberRepository repository, String name, String email, String role) {
        TeamMember member = new TeamMember();
        member.setName(name);
        member.setEmail(email);
        member.setRole(role);
        repository.save(member);
    }

    private void addEvent(EventRepository repository, String title, LocalDate date, EventType type, String participants) {
        Event event = new Event();
        event.setTitle(title);
        event.setEventDate(date);
        event.setType(type);
        event.setParticipants(participants);
        repository.save(event);
    }

    private void addNote(NoteRepository repository, String title, String content, String ownerName, boolean individual) {
        Note note = new Note();
        note.setTitle(title);
        note.setContent(content);
        note.setOwnerName(ownerName);
        note.setIndividual(individual);
        repository.save(note);
    }

    private void addTutorial(TutorialRepository repository, String title, String content, String link) {
        Tutorial tutorial = new Tutorial();
        tutorial.setTitle(title);
        tutorial.setContent(content);
        tutorial.setLink(link);
        repository.save(tutorial);
    }

    private void addAlert(AlertRepository repository, String title, String message, LocalDate dueDate) {
        Alert alert = new Alert();
        alert.setTitle(title);
        alert.setMessage(message);
        alert.setDueDate(dueDate);
        repository.save(alert);
    }
}
