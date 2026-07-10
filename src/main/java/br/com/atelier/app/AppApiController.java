package br.com.atelier.app;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
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

@RestController
@RequestMapping("/api/app")
public class AppApiController {

    private final AppUserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final AppNoteRepository noteRepository;
    private final AppAlertRepository alertRepository;
    private final AppTutorialRepository tutorialRepository;

    public AppApiController(
            AppUserRepository userRepository,
            ProfileRepository profileRepository,
            TaskRepository taskRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            AppNoteRepository noteRepository,
            AppAlertRepository alertRepository,
            AppTutorialRepository tutorialRepository) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.taskRepository = taskRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.noteRepository = noteRepository;
        this.alertRepository = alertRepository;
        this.tutorialRepository = tutorialRepository;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "storage", "database");
    }

    @PostMapping("/auth/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@RequestBody AuthRequest request) {
        String email = clean(request.email).toLowerCase();
        if (email.isBlank() || clean(request.password).length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe email e senha com pelo menos 6 caracteres.");
        }
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ja cadastrado.");
        }

        AppUser user = new AppUser();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPassword(request.password);
        user.setDisplayName(clean(request.display_name).isBlank() ? email : clean(request.display_name));
        userRepository.save(user);

        Profile profile = new Profile();
        profile.setId(user.getId());
        profile.setDisplayName(user.getDisplayName());
        profileRepository.save(profile);

        return new AuthResponse(toUserResponse(user));
    }

    @PostMapping("/auth/signin")
    public AuthResponse signin(@RequestBody AuthRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(clean(request.email))
                .filter(item -> Objects.equals(item.getPassword(), request.password))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email e/ou senha incorretos."));
        return new AuthResponse(toUserResponse(user));
    }

    @GetMapping("/profiles")
    public List<Profile> profiles() {
        return profileRepository.findAll().stream()
                .sorted(Comparator.comparing(profile -> profile.getDisplayName()))
                .toList();
    }

    @PutMapping("/profiles/{id}")
    public AuthResponse updateProfile(@PathVariable String id, @RequestBody ProfileUpdateRequest request) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario nao encontrado."));

        String email = clean(request.email());
        if (!email.isBlank() && userRepository.findByEmailIgnoreCase(email)
                .filter(item -> !item.getId().equals(id))
                .isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ja cadastrado.");
        }

        String displayName = clean(request.display_name());
        String password = clean(request.password());
        if (!password.isBlank() && password.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha precisa ter pelo menos 6 caracteres.");
        }

        if (!email.isBlank()) {
            user.setEmail(email.toLowerCase());
        }
        if (!displayName.isBlank()) {
            user.setDisplayName(displayName);
            Profile profile = profileRepository.findById(id).orElseGet(() -> {
                Profile created = new Profile();
                created.setId(id);
                return created;
            });
            profile.setDisplayName(displayName);
            profileRepository.save(profile);
        }
        if (!password.isBlank()) {
            user.setPassword(password);
        }

        userRepository.save(user);
        return new AuthResponse(toUserResponse(user));
    }

    @GetMapping("/tasks")
    public List<Task> tasks(String start, String end, String scope, String createdBy) {
        List<Task> tasks = (start == null && end == null)
                ? taskRepository.findAllByOrderByTaskDateAscTitleAsc()
                : taskRepository.findByTaskDateBetweenOrderByTaskDateAscTitleAsc(start, end);
        return tasks.stream()
                .filter(task -> scope == null || Objects.equals(task.getScope(), scope))
                .filter(task -> createdBy == null || Objects.equals(task.getCreatedBy(), createdBy))
                .sorted(Comparator.comparing(Task::getTaskDate).thenComparing(Task::getTitle))
                .toList();
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public Task createTask(@RequestBody Task task) {
        task.setId(UUID.randomUUID().toString());
        task.setCreatedAt(java.time.Instant.now().toString());
        return taskRepository.save(task);
    }

    @PutMapping("/tasks/{id}")
    public Task updateTask(@PathVariable String id, @RequestBody Task update) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (update.getTitle() != null) task.setTitle(update.getTitle());
        if (update.getDescription() != null) task.setDescription(update.getDescription());
        if (update.getTaskDate() != null) task.setTaskDate(update.getTaskDate());
        if (update.getScope() != null) task.setScope(update.getScope());
        task.setDone(update.isDone());
        return taskRepository.save(task);
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTask(@PathVariable String id) {
        taskRepository.deleteById(id);
        taskAssigneeRepository.deleteByTaskId(id);
    }

    @GetMapping("/task-assignees")
    public List<TaskAssignee> taskAssignees(String taskIds) {
        List<String> ids = taskIds == null || taskIds.isBlank() ? List.of() : List.of(taskIds.split(","));
        if (ids.isEmpty()) {
            return List.of();
        }
        return taskAssigneeRepository.findByTaskIdIn(ids);
    }

    @PostMapping("/task-assignees")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TaskAssignee> createTaskAssignees(@RequestBody List<TaskAssignee> rows) {
        return taskAssigneeRepository.saveAll(rows);
    }

    @GetMapping("/notes")
    public List<AppNote> notes(String scope, String userId) {
        if (scope != null && userId != null) {
            return noteRepository.findByScopeAndUserIdOrderByUpdatedAtDesc(scope, userId);
        }
        if (scope != null) {
            return noteRepository.findByScopeOrderByUpdatedAtDesc(scope);
        }
        if (userId != null) {
            return noteRepository.findByUserIdOrderByUpdatedAtDesc(userId);
        }
        return noteRepository.findAllByOrderByUpdatedAtDesc();
    }

    @PostMapping("/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public AppNote createNote(@RequestBody AppNote note) {
        note.setId(UUID.randomUUID().toString());
        String now = java.time.Instant.now().toString();
        note.setCreatedAt(now);
        note.setUpdatedAt(now);
        return noteRepository.save(note);
    }

    @PutMapping("/notes/{id}")
    public AppNote updateNote(@PathVariable String id, @RequestBody AppNote update) {
        AppNote note = noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        note.setTitle(update.getTitle());
        note.setContent(update.getContent());
        note.setUpdatedAt(java.time.Instant.now().toString());
        return noteRepository.save(note);
    }

    @DeleteMapping("/notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(@PathVariable String id) {
        noteRepository.deleteById(id);
    }

    @GetMapping("/alerts")
    public List<AppAlert> alerts() {
        return alertRepository.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping("/alerts")
    @ResponseStatus(HttpStatus.CREATED)
    public AppAlert createAlert(@RequestBody AppAlert alert) {
        alert.setId(UUID.randomUUID().toString());
        alert.setCreatedAt(java.time.Instant.now().toString());
        return alertRepository.save(alert);
    }

    @DeleteMapping("/alerts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAlert(@PathVariable String id) {
        alertRepository.deleteById(id);
    }

    @GetMapping("/tutorials")
    public List<AppTutorial> tutorials() {
        return tutorialRepository.findAll();
    }

    @PostMapping("/tutorials")
    @ResponseStatus(HttpStatus.CREATED)
    public AppTutorial createTutorial(@RequestBody AppTutorial tutorial) {
        tutorial.setId(UUID.randomUUID().toString());
        tutorial.setCreatedAt(java.time.Instant.now().toString());
        return tutorialRepository.save(tutorial);
    }

    @DeleteMapping("/tutorials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTutorial(@PathVariable String id) {
        tutorialRepository.deleteById(id);
    }

    private UserResponse toUserResponse(AppUser user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName());
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    public record AuthRequest(String email, String password, String display_name) {
    }

    public record AuthResponse(UserResponse user) {
    }

    public record UserResponse(String id, String email, String display_name) {
    }

    public record ProfileUpdateRequest(String email, String display_name, String password) {
    }
}
