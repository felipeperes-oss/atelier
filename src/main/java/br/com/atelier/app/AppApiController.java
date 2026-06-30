package br.com.atelier.app;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import br.com.atelier.alert.Alert;
import br.com.atelier.alert.AlertRepository;
import br.com.atelier.note.Note;
import br.com.atelier.note.NoteRepository;
import br.com.atelier.task.Task;
import br.com.atelier.task.TaskAssignee;
import br.com.atelier.task.TaskAssigneeId;
import br.com.atelier.task.TaskAssigneeRepository;
import br.com.atelier.task.TaskRepository;
import br.com.atelier.tutorial.Tutorial;
import br.com.atelier.tutorial.TutorialRepository;
import br.com.atelier.user.AppUser;
import br.com.atelier.user.AppUserRepository;
import br.com.atelier.user.Profile;
import br.com.atelier.user.ProfileRepository;

import jakarta.transaction.Transactional;

@RestController
@RequestMapping("/api/app")
public class AppApiController {

    private final AppUserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final NoteRepository noteRepository;
    private final AlertRepository alertRepository;
    private final TutorialRepository tutorialRepository;

    public AppApiController(
            AppUserRepository userRepository,
            ProfileRepository profileRepository,
            TaskRepository taskRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            NoteRepository noteRepository,
            AlertRepository alertRepository,
            TutorialRepository tutorialRepository) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.taskRepository = taskRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.noteRepository = noteRepository;
        this.alertRepository = alertRepository;
        this.tutorialRepository = tutorialRepository;
    }

    // ---- Health ----

    @GetMapping("/health")
    public java.util.Map<String, String> health() {
        return java.util.Map.of("status", "UP", "storage", "jpa");
    }

    // ---- Auth ----

    @PostMapping("/auth/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@RequestBody AuthRequest request) {
        String email = clean(request.email()).toLowerCase();
        if (email.isBlank() || clean(request.password()).length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Informe email e senha com pelo menos 6 caracteres.");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ja cadastrado.");
        }

        AppUser user = new AppUser();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPassword(request.password());
        user.setDisplayName(clean(request.display_name()).isBlank() ? email : clean(request.display_name()));
        userRepository.save(user);

        Profile profile = new Profile();
        profile.setId(user.getId());
        profile.setDisplayName(user.getDisplayName());
        profileRepository.save(profile);

        return new AuthResponse(toUserResponse(user));
    }

    @PostMapping("/auth/signin")
    public AuthResponse signin(@RequestBody AuthRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(clean(request.email()))
                .filter(u -> Objects.equals(u.getPassword(), request.password()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Email ou senha invalidos."));
        return new AuthResponse(toUserResponse(user));
    }

    // ---- Profiles ----

    @GetMapping("/profiles")
    public List<ProfileResponse> profiles() {
        return profileRepository.findAllByOrderByDisplayNameAsc().stream()
                .map(p -> new ProfileResponse(p.getId(), p.getDisplayName()))
                .toList();
    }

    @PutMapping("/profiles/{id}")
    public AuthResponse updateProfile(@PathVariable String id, @RequestBody ProfileUpdateRequest request) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Usuario nao encontrado."));

        String email = clean(request.email());
        if (!email.isBlank()) {
            boolean emailTaken = userRepository.findByEmailIgnoreCase(email)
                    .filter(u -> !u.getId().equals(id))
                    .isPresent();
            if (emailTaken) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ja cadastrado.");
            }
            user.setEmail(email.toLowerCase());
        }

        String displayName = clean(request.display_name());
        if (!displayName.isBlank()) {
            user.setDisplayName(displayName);
            Profile profile = profileRepository.findById(id).orElseGet(() -> {
                Profile p = new Profile();
                p.setId(id);
                return p;
            });
            profile.setDisplayName(displayName);
            profileRepository.save(profile);
        }

        String password = clean(request.password());
        if (!password.isBlank()) {
            if (password.length() < 6) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A senha precisa ter pelo menos 6 caracteres.");
            }
            user.setPassword(password);
        }

        userRepository.save(user);
        return new AuthResponse(toUserResponse(user));
    }

    // ---- Tasks ----

    @GetMapping("/tasks")
    public List<TaskResponse> tasks(String start, String end, String scope, String createdBy) {
        return taskRepository.findAll().stream()
                .filter(task -> start == null || !task.getTaskDate().isBefore(LocalDate.parse(start)))
                .filter(task -> end == null || !task.getTaskDate().isAfter(LocalDate.parse(end)))
                .filter(task -> scope == null || scope.equals(task.getScope()))
                .filter(task -> createdBy == null || createdBy.equals(task.getCreatedBy()))
                .sorted(Comparator.comparing(Task::getTaskDate).thenComparing(Task::getTitle))
                .map(this::toTaskResponse)
                .toList();
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse createTask(@RequestBody TaskRequest request) {
        Task task = new Task();
        task.setTitle(request.title);
        task.setDescription(request.description);
        task.setTaskDate(LocalDate.parse(request.task_date));
        task.setScope(request.scope != null ? request.scope : "group");
        task.setDone(request.done);
        task.setCreatedBy(request.created_by);
        taskRepository.save(task);
        return toTaskResponse(task);
    }

    @PutMapping("/tasks/{id}")
    public TaskResponse updateTask(@PathVariable String id, @RequestBody TaskRequest update) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (update.title != null) task.setTitle(update.title);
        if (update.description != null) task.setDescription(update.description);
        if (update.task_date != null) task.setTaskDate(LocalDate.parse(update.task_date));
        if (update.scope != null) task.setScope(update.scope);
        task.setDone(update.done);
        taskRepository.save(task);
        return toTaskResponse(task);
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteTask(@PathVariable String id) {
        taskAssigneeRepository.deleteByIdTaskId(id);
        taskRepository.deleteById(id);
    }

    // ---- Task Assignees ----

    @GetMapping("/task-assignees")
    public List<TaskAssigneeResponse> taskAssignees(String taskIds) {
        List<String> ids = taskIds == null || taskIds.isBlank()
                ? List.of()
                : List.of(taskIds.split(","));

        List<TaskAssignee> assignees = ids.isEmpty()
                ? taskAssigneeRepository.findAll()
                : taskAssigneeRepository.findByIdTaskIdIn(ids);

        return assignees.stream()
                .map(a -> new TaskAssigneeResponse(a.getTaskId(), a.getUserId()))
                .toList();
    }

    @PostMapping("/task-assignees")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TaskAssigneeResponse> createTaskAssignees(@RequestBody List<TaskAssigneeRequest> rows) {
        List<TaskAssignee> entities = rows.stream()
                .map(r -> new TaskAssignee(r.task_id, r.user_id))
                .toList();
        taskAssigneeRepository.saveAll(entities);
        return entities.stream()
                .map(a -> new TaskAssigneeResponse(a.getTaskId(), a.getUserId()))
                .toList();
    }

    // ---- Notes ----

    @GetMapping("/notes")
    public List<NoteResponse> notes(String scope, String userId) {
        List<Note> result;
        if (scope != null && userId != null) {
            result = noteRepository.findByScopeAndUserIdOrderByUpdatedAtDesc(scope, userId);
        } else if (scope != null) {
            result = noteRepository.findByScopeOrderByUpdatedAtDesc(scope);
        } else if (userId != null) {
            result = noteRepository.findByUserIdOrderByUpdatedAtDesc(userId);
        } else {
            result = noteRepository.findAllByOrderByUpdatedAtDesc();
        }
        return result.stream().map(this::toNoteResponse).toList();
    }

    @PostMapping("/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse createNote(@RequestBody NoteRequest request) {
        Note note = new Note();
        note.setTitle(request.title);
        note.setContent(request.content);
        note.setScope(request.scope != null ? request.scope : "general");
        note.setUserId(request.user_id);
        noteRepository.save(note);
        return toNoteResponse(note);
    }

    @PutMapping("/notes/{id}")
    public NoteResponse updateNote(@PathVariable String id, @RequestBody NoteRequest update) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        note.setTitle(update.title);
        note.setContent(update.content);
        noteRepository.save(note);
        return toNoteResponse(note);
    }

    @DeleteMapping("/notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(@PathVariable String id) {
        noteRepository.deleteById(id);
    }

    // ---- Alerts ----

    @GetMapping("/alerts")
    public List<AlertResponse> alerts() {
        return alertRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toAlertResponse)
                .toList();
    }

    @PostMapping("/alerts")
    @ResponseStatus(HttpStatus.CREATED)
    public AlertResponse createAlert(@RequestBody AlertRequest request) {
        Alert alert = new Alert();
        alert.setTitle(request.title);
        alert.setMessage(request.message);
        alert.setPriority(request.priority != null ? request.priority : "normal");
        alert.setUserId(request.user_id);
        alertRepository.save(alert);
        return toAlertResponse(alert);
    }

    @DeleteMapping("/alerts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAlert(@PathVariable String id) {
        alertRepository.deleteById(id);
    }

    // ---- Tutorials ----

    @GetMapping("/tutorials")
    public List<TutorialResponse> tutorials() {
        return tutorialRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toTutorialResponse)
                .toList();
    }

    @PostMapping("/tutorials")
    @ResponseStatus(HttpStatus.CREATED)
    public TutorialResponse createTutorial(@RequestBody TutorialRequest request) {
        Tutorial tutorial = new Tutorial();
        tutorial.setTitle(request.title);
        tutorial.setContent(request.content);
        tutorial.setUrl(request.url);
        tutorial.setUserId(request.user_id);
        tutorialRepository.save(tutorial);
        return toTutorialResponse(tutorial);
    }

    @DeleteMapping("/tutorials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTutorial(@PathVariable String id) {
        tutorialRepository.deleteById(id);
    }

    // ---- Helpers ----

    private UserResponse toUserResponse(AppUser user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName());
    }

    private TaskResponse toTaskResponse(Task task) {
        return new TaskResponse(
                task.getId(), task.getTitle(), task.getDescription(),
                task.getTaskDate().toString(), task.getScope(), task.isDone(),
                task.getCreatedBy(),
                task.getCreatedAt() != null ? task.getCreatedAt().toString() : null);
    }

    private NoteResponse toNoteResponse(Note note) {
        return new NoteResponse(
                note.getId(), note.getTitle(), note.getContent(),
                note.getScope(), note.getUserId(),
                note.getCreatedAt() != null ? note.getCreatedAt().toString() : null,
                note.getUpdatedAt() != null ? note.getUpdatedAt().toString() : null);
    }

    private AlertResponse toAlertResponse(Alert alert) {
        return new AlertResponse(
                alert.getId(), alert.getTitle(), alert.getMessage(),
                alert.getPriority(), alert.getUserId(),
                alert.getCreatedAt() != null ? alert.getCreatedAt().toString() : null);
    }

    private TutorialResponse toTutorialResponse(Tutorial tutorial) {
        return new TutorialResponse(
                tutorial.getId(), tutorial.getTitle(), tutorial.getContent(),
                tutorial.getUrl(), tutorial.getUserId(),
                tutorial.getCreatedAt() != null ? tutorial.getCreatedAt().toString() : null);
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    // ---- DTOs ----

    public record AuthRequest(String email, String password, String display_name) {}
    public record AuthResponse(UserResponse user) {}
    public record UserResponse(String id, String email, String display_name) {}
    public record ProfileUpdateRequest(String email, String display_name, String password) {}
    public record ProfileResponse(String id, String display_name) {}

    public static class TaskRequest {
        public String title;
        public String description;
        public String task_date;
        public String scope;
        public boolean done;
        public String created_by;
        public String created_at;
    }

    public record TaskResponse(String id, String title, String description,
            String task_date, String scope, boolean done,
            String created_by, String created_at) {}

    public static class TaskAssigneeRequest {
        public String task_id;
        public String user_id;
    }

    public record TaskAssigneeResponse(String task_id, String user_id) {}

    public static class NoteRequest {
        public String title;
        public String content;
        public String scope;
        public String user_id;
    }

    public record NoteResponse(String id, String title, String content,
            String scope, String user_id,
            String created_at, String updated_at) {}

    public static class AlertRequest {
        public String title;
        public String message;
        public String priority;
        public String user_id;
    }

    public record AlertResponse(String id, String title, String message,
            String priority, String user_id, String created_at) {}

    public static class TutorialRequest {
        public String title;
        public String content;
        public String url;
        public String user_id;
    }

    public record TutorialResponse(String id, String title, String content,
            String url, String user_id, String created_at) {}
}
