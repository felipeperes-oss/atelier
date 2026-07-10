package br.com.atelier.app;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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

    private final JsonDataStore store;

    public AppApiController(JsonDataStore store) {
        this.store = store;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "storage", "json");
    }

    @PostMapping("/auth/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@RequestBody AuthRequest request) {
        AppData data = store.read();
        String email = clean(request.email).toLowerCase();
        if (email.isBlank() || clean(request.password).length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe email e senha com pelo menos 6 caracteres.");
        }
        boolean exists = data.users.stream().anyMatch(user -> user.email.equalsIgnoreCase(email));
        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ja cadastrado.");
        }

        AppData.AppUser user = new AppData.AppUser();
        user.id = store.newId();
        user.email = email;
        user.password = request.password;
        user.display_name = clean(request.display_name).isBlank() ? email : clean(request.display_name);
        data.users.add(user);

        AppData.Profile profile = new AppData.Profile();
        profile.id = user.id;
        profile.display_name = user.display_name;
        data.profiles.add(profile);

        store.write(data);
        return new AuthResponse(toUserResponse(user));
    }

    @PostMapping("/auth/signin")
    public AuthResponse signin(@RequestBody AuthRequest request) {
        AppData.AppUser user = store.read().users.stream()
                .filter(item -> item.email.equalsIgnoreCase(clean(request.email)))
                .filter(item -> Objects.equals(item.password, request.password))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou senha invalidos."));
        return new AuthResponse(toUserResponse(user));
    }

    @GetMapping("/profiles")
    public List<AppData.Profile> profiles() {
        return store.read().profiles.stream()
                .sorted(Comparator.comparing(profile -> profile.display_name))
                .toList();
    }

    @PutMapping("/profiles/{id}")
    public AuthResponse updateProfile(@PathVariable String id, @RequestBody ProfileUpdateRequest request) {
        AppData data = store.read();
        AppData.AppUser user = data.users.stream()
                .filter(item -> item.id.equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario nao encontrado."));

        String email = clean(request.email());
        if (!email.isBlank() && data.users.stream()
                .anyMatch(item -> !item.id.equals(id) && item.email.equalsIgnoreCase(email))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ja cadastrado.");
        }

        String displayName = clean(request.display_name());
        String password = clean(request.password());
        if (!password.isBlank() && password.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha precisa ter pelo menos 6 caracteres.");
        }

        if (!email.isBlank()) {
            user.email = email.toLowerCase();
        }
        if (!displayName.isBlank()) {
            user.display_name = displayName;
            AppData.Profile profile = data.profiles.stream()
                    .filter(item -> item.id.equals(id))
                    .findFirst()
                    .orElseGet(() -> {
                        AppData.Profile created = new AppData.Profile();
                        created.id = id;
                        data.profiles.add(created);
                        return created;
                    });
            profile.display_name = displayName;
        }
        if (!password.isBlank()) {
            user.password = password;
        }

        store.write(data);
        return new AuthResponse(toUserResponse(user));
    }

    @GetMapping("/tasks")
    public List<AppData.Task> tasks(String start, String end, String scope, String createdBy) {
        return store.read().tasks.stream()
                .filter(task -> start == null || task.task_date.compareTo(start) >= 0)
                .filter(task -> end == null || task.task_date.compareTo(end) <= 0)
                .filter(task -> scope == null || task.scope.equals(scope))
                .filter(task -> createdBy == null || task.created_by.equals(createdBy))
                .sorted(Comparator.comparing((AppData.Task task) -> task.task_date).thenComparing(task -> task.title))
                .toList();
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public AppData.Task createTask(@RequestBody AppData.Task task) {
        AppData data = store.read();
        task.id = store.newId();
        task.created_at = store.now();
        data.tasks.add(task);
        store.write(data);
        return task;
    }

    @PutMapping("/tasks/{id}")
    public AppData.Task updateTask(@PathVariable String id, @RequestBody AppData.Task update) {
        AppData data = store.read();
        AppData.Task task = findTask(data, id);
        if (update.title != null) task.title = update.title;
        if (update.description != null) task.description = update.description;
        if (update.task_date != null) task.task_date = update.task_date;
        if (update.scope != null) task.scope = update.scope;
        task.done = update.done;
        store.write(data);
        return task;
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTask(@PathVariable String id) {
        AppData data = store.read();
        data.tasks.removeIf(task -> task.id.equals(id));
        data.task_assignees.removeIf(assignee -> assignee.task_id.equals(id));
        store.write(data);
    }

    @GetMapping("/task-assignees")
    public List<AppData.TaskAssignee> taskAssignees(String taskIds) {
        List<String> ids = taskIds == null || taskIds.isBlank() ? List.of() : List.of(taskIds.split(","));
        return store.read().task_assignees.stream()
                .filter(assignee -> ids.isEmpty() || ids.contains(assignee.task_id))
                .toList();
    }

    @PostMapping("/task-assignees")
    @ResponseStatus(HttpStatus.CREATED)
    public List<AppData.TaskAssignee> createTaskAssignees(@RequestBody List<AppData.TaskAssignee> rows) {
        AppData data = store.read();
        data.task_assignees.addAll(rows);
        store.write(data);
        return rows;
    }

    @GetMapping("/notes")
    public List<AppData.AppNote> notes(String scope, String userId) {
        return store.read().notes.stream()
                .filter(note -> scope == null || note.scope.equals(scope))
                .filter(note -> userId == null || note.user_id.equals(userId))
                .sorted(Comparator.comparing((AppData.AppNote note) -> note.updated_at).reversed())
                .toList();
    }

    @PostMapping("/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public AppData.AppNote createNote(@RequestBody AppData.AppNote note) {
        AppData data = store.read();
        note.id = store.newId();
        note.created_at = store.now();
        note.updated_at = note.created_at;
        data.notes.add(note);
        store.write(data);
        return note;
    }

    @PutMapping("/notes/{id}")
    public AppData.AppNote updateNote(@PathVariable String id, @RequestBody AppData.AppNote update) {
        AppData data = store.read();
        AppData.AppNote note = data.notes.stream()
                .filter(item -> item.id.equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        note.title = update.title;
        note.content = update.content;
        note.updated_at = store.now();
        store.write(data);
        return note;
    }

    @DeleteMapping("/notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(@PathVariable String id) {
        AppData data = store.read();
        data.notes.removeIf(note -> note.id.equals(id));
        store.write(data);
    }

    @GetMapping("/alerts")
    public List<AppData.AppAlert> alerts() {
        return store.read().alerts.stream()
                .sorted(Comparator.comparing((AppData.AppAlert alert) -> alert.created_at).reversed())
                .toList();
    }

    @PostMapping("/alerts")
    @ResponseStatus(HttpStatus.CREATED)
    public AppData.AppAlert createAlert(@RequestBody AppData.AppAlert alert) {
        AppData data = store.read();
        alert.id = store.newId();
        alert.created_at = store.now();
        data.alerts.add(alert);
        store.write(data);
        return alert;
    }

    @DeleteMapping("/alerts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAlert(@PathVariable String id) {
        AppData data = store.read();
        data.alerts.removeIf(alert -> alert.id.equals(id));
        store.write(data);
    }

    @GetMapping("/tutorials")
    public List<AppData.AppTutorial> tutorials() {
        return store.read().tutorials.stream()
                .sorted(Comparator.comparing((AppData.AppTutorial tutorial) -> tutorial.created_at).reversed())
                .toList();
    }

    @PostMapping("/tutorials")
    @ResponseStatus(HttpStatus.CREATED)
    public AppData.AppTutorial createTutorial(@RequestBody AppData.AppTutorial tutorial) {
        AppData data = store.read();
        tutorial.id = store.newId();
        tutorial.created_at = store.now();
        data.tutorials.add(tutorial);
        store.write(data);
        return tutorial;
    }

    @DeleteMapping("/tutorials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTutorial(@PathVariable String id) {
        AppData data = store.read();
        data.tutorials.removeIf(tutorial -> tutorial.id.equals(id));
        store.write(data);
    }

    private AppData.Task findTask(AppData data, String id) {
        return data.tasks.stream()
                .filter(task -> task.id.equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private UserResponse toUserResponse(AppData.AppUser user) {
        return new UserResponse(user.id, user.email, user.display_name);
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
