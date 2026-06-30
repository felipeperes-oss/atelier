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
import br.com.atelier.task.Task;
import br.com.atelier.task.TaskAssignee;
import br.com.atelier.task.TaskAssigneeRepository;
import br.com.atelier.task.TaskRepository;
import br.com.atelier.team.TeamMember;
import br.com.atelier.team.TeamMemberRepository;
import br.com.atelier.tutorial.Tutorial;
import br.com.atelier.tutorial.TutorialRepository;
import br.com.atelier.user.AppUser;
import br.com.atelier.user.AppUserRepository;
import br.com.atelier.user.Profile;
import br.com.atelier.user.ProfileRepository;

@Configuration
public class DataLoader {

    @Bean
    CommandLineRunner loadInitialData(
            AppUserRepository users,
            ProfileRepository profiles,
            EventRepository events,
            TeamMemberRepository members,
            TaskRepository tasks,
            TaskAssigneeRepository taskAssignees,
            NoteRepository notes,
            TutorialRepository tutorials,
            AlertRepository alerts) {
        return args -> {
            if (users.count() > 0) {
                return;
            }

            // Users and profiles
            addUser(users, profiles, "user-alessandra", "alessandra@atelier.local", "123456", "Alessandra");
            addUser(users, profiles, "user-felipe", "felipe@atelier.local", "123456", "Felipe");
            addUser(users, profiles, "user-lucas", "lucas@atelier.local", "123456", "Lucas");
            addUser(users, profiles, "user-herysson", "herysson@atelier.local", "123456", "Herysson");

            // Team members
            addMember(members, "Alessandra", "alessandra@atelier.local", "Equipe");
            addMember(members, "Felipe", "felipe@atelier.local", "Equipe");
            addMember(members, "Lucas", "lucas@atelier.local", "Individual");
            addMember(members, "Herysson", "herysson@atelier.local", "Equipe");

            // Events
            addEvent(events, "Reuniao de Equipe", LocalDate.of(2026, 6, 9), EventType.TEAM, "Alessandra, Felipe +1");
            addEvent(events, "HC UFMG", LocalDate.of(2026, 6, 15), EventType.INDIVIDUAL, "Lucas");
            addEvent(events, "Master Remoto", LocalDate.of(2026, 6, 19), EventType.TEAM, "Felipe, Alessandra");
            addEvent(events, "Apresentacao", LocalDate.of(2026, 6, 23), EventType.TEAM, "Alessandra, Herysson");

            // Tasks
            addTask(tasks, "task-1", "Reuniao de Equipe", LocalDate.of(2026, 6, 9), "group", "user-felipe");
            addTask(tasks, "task-2", "HC UFMG", LocalDate.of(2026, 6, 15), "individual", "user-lucas");
            addTask(tasks, "task-3", "Master Remoto", LocalDate.of(2026, 6, 19), "group", "user-felipe");
            addTask(tasks, "task-4", "Apresentacao", LocalDate.of(2026, 6, 23), "group", "user-alessandra");

            // Task assignees
            taskAssignees.save(new TaskAssignee("task-1", "user-alessandra"));
            taskAssignees.save(new TaskAssignee("task-1", "user-felipe"));
            taskAssignees.save(new TaskAssignee("task-2", "user-lucas"));
            taskAssignees.save(new TaskAssignee("task-3", "user-felipe"));
            taskAssignees.save(new TaskAssignee("task-3", "user-alessandra"));
            taskAssignees.save(new TaskAssignee("task-4", "user-alessandra"));
            taskAssignees.save(new TaskAssignee("task-4", "user-herysson"));

            // Notes
            addNote(notes, "note-1", "Anotacoes gerais", "Espaco para registrar pontos gerais da equipe.", "general", "user-felipe");
            addNote(notes, "note-2", "Anotacoes individuais", "Espaco para observacoes individuais.", "individual", "user-felipe");

            // Tutorial
            addTutorial(tutorials, "tutorial-1", "Fluxo do calendario", "Cadastrar eventos com data, tipo e participantes.", null, "user-felipe");

            // Alert
            addAlert(alerts, "alert-1", "Revisar agenda da semana", "Conferir eventos e responsaveis antes da reuniao.", "normal", "user-felipe");
        };
    }

    private void addUser(AppUserRepository users, ProfileRepository profiles,
            String id, String email, String password, String displayName) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setPassword(password);
        user.setDisplayName(displayName);
        users.save(user);

        Profile profile = new Profile();
        profile.setId(id);
        profile.setDisplayName(displayName);
        profiles.save(profile);
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

    private void addTask(TaskRepository repository, String id, String title, LocalDate date, String scope, String createdBy) {
        Task task = new Task();
        task.setId(id);
        task.setTitle(title);
        task.setTaskDate(date);
        task.setScope(scope);
        task.setCreatedBy(createdBy);
        repository.save(task);
    }

    private void addNote(NoteRepository repository, String id, String title, String content, String scope, String userId) {
        Note note = new Note();
        note.setId(id);
        note.setTitle(title);
        note.setContent(content);
        note.setScope(scope);
        note.setUserId(userId);
        repository.save(note);
    }

    private void addTutorial(TutorialRepository repository, String id, String title, String content, String url, String userId) {
        Tutorial tutorial = new Tutorial();
        tutorial.setId(id);
        tutorial.setTitle(title);
        tutorial.setContent(content);
        tutorial.setUrl(url);
        tutorial.setUserId(userId);
        repository.save(tutorial);
    }

    private void addAlert(AlertRepository repository, String id, String title, String message, String priority, String userId) {
        Alert alert = new Alert();
        alert.setId(id);
        alert.setTitle(title);
        alert.setMessage(message);
        alert.setPriority(priority);
        alert.setUserId(userId);
        repository.save(alert);
    }
}
