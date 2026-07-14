package br.com.atelier.app;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/app")
public class AppApiController {

    private static final Path CHAT_UPLOAD_ROOT = Path.of("chat-uploads");

    private final JdbcTemplate jdbcTemplate;
    private final AppUserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final AppChecklistRepository checklistRepository;
    private final AppChecklistItemRepository checklistItemRepository;
    private final AppNoteRepository noteRepository;
    private final AppAlertRepository alertRepository;
    private final AppTutorialRepository tutorialRepository;
    private final AppFileRepository fileRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final ConversationSseService conversationSseService;

    public AppApiController(
            JdbcTemplate jdbcTemplate,
            AppUserRepository userRepository,
            ProfileRepository profileRepository,
            TaskRepository taskRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            AppChecklistRepository checklistRepository,
            AppChecklistItemRepository checklistItemRepository,
            AppNoteRepository noteRepository,
            AppAlertRepository alertRepository,
            AppTutorialRepository tutorialRepository,
            AppFileRepository fileRepository,
            ConversationRepository conversationRepository,
            ConversationMessageRepository conversationMessageRepository,
            ConversationSseService conversationSseService) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.taskRepository = taskRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.checklistRepository = checklistRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.noteRepository = noteRepository;
        this.alertRepository = alertRepository;
        this.tutorialRepository = tutorialRepository;
        this.fileRepository = fileRepository;
        this.conversationRepository = conversationRepository;
        this.conversationMessageRepository = conversationMessageRepository;
        this.conversationSseService = conversationSseService;
    }

    @PostConstruct
    public void initUploadDirectory() throws IOException {
        Files.createDirectories(CHAT_UPLOAD_ROOT);
        migrateChatMessageContentColumn();
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "storage", "database");
    }

    @PostMapping("/auth/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@RequestBody AuthRequest request) {
        String email = clean(request.email).toLowerCase();
        String displayName = clean(request.display_name);
        if (email.isBlank() || displayName.isBlank() || clean(request.password).length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe nome, email e senha com pelo menos 6 caracteres.");
        }
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email ja cadastrado.");
        }

        AppUser user = new AppUser();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPassword(request.password);
        user.setDisplayName(displayName);
        userRepository.save(user);

        Profile profile = new Profile();
        profile.setId(user.getId());
        profile.setDisplayName(user.getDisplayName());
        profile.setPhotoUrl(user.getPhotoUrl());
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
                .filter(profile -> !clean(profile.getDisplayName()).isBlank())
                .filter(profile -> userRepository.existsById(profile.getId()))
                .sorted(Comparator.comparing(
                        profile -> clean(profile.getDisplayName()),
                        String.CASE_INSENSITIVE_ORDER
                ))
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
            Profile profile = profileForUser(user);
            profile.setDisplayName(displayName);
            profile.setPhotoUrl(user.getPhotoUrl());
            profileRepository.save(profile);
        }
        if (!password.isBlank()) {
            user.setPassword(password);
        }

        userRepository.save(user);
        return new AuthResponse(toUserResponse(user));
    }

    @PostMapping(value = "/profiles/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AuthResponse updateProfilePhoto(@PathVariable String id, @RequestPart("file") MultipartFile file) throws IOException {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario nao encontrado."));
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione uma imagem para o perfil.");
        }
        String mimeType = clean(file.getContentType());
        if (!mimeType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A foto do perfil precisa ser uma imagem.");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie uma imagem de ate 5 MB.");
        }

        StoredFile storedFile = storeUploadedFile(file);
        user.setPhotoUrl(storedFile.fileUrl());
        userRepository.save(user);

        Profile profile = profileForUser(user);
        profile.setDisplayName(user.getDisplayName());
        profile.setPhotoUrl(storedFile.fileUrl());
        profileRepository.save(profile);

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
        Task saved = taskRepository.save(task);
        publishTaskChanged(saved, "created");
        return saved;
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
        Task saved = taskRepository.save(task);
        publishTaskChanged(saved, "updated");
        return saved;
    }

    @PutMapping("/tasks/{id}/assignees")
    @Transactional
    public List<TaskAssignee> updateTaskAssignees(@PathVariable String id, @RequestBody List<TaskAssignee> rows) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarefa nao encontrada."));
        taskAssigneeRepository.deleteByTaskId(id);
        List<TaskAssignee> normalized = rows == null ? List.of() : rows.stream()
                .filter(row -> !clean(row.getUserId()).isBlank())
                .map(row -> {
                    TaskAssignee assignee = new TaskAssignee();
                    assignee.setTaskId(id);
                    assignee.setUserId(clean(row.getUserId()));
                    return assignee;
                })
                .toList();
        List<TaskAssignee> saved = taskAssigneeRepository.saveAll(normalized);
        publishTaskChanged(task, "updated");
        return saved;
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteTask(@PathVariable String id, @RequestParam(required = false) String deletedBy) {
        Task task = taskRepository.findById(id).orElse(null);
        taskAssigneeRepository.deleteByTaskId(id);
        taskRepository.deleteById(id);
        if (task != null) {
            publishTaskDeleted(task, clean(deletedBy));
        }
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
        List<TaskAssignee> saved = taskAssigneeRepository.saveAll(rows);
        saved.stream()
                .map(TaskAssignee::getTaskId)
                .distinct()
                .forEach(this::publishTaskChanged);
        return saved;
    }

    @GetMapping("/checklists")
    public List<AppChecklist> checklists(String scope, String createdBy) {
        return checklistRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(checklist -> scope == null || Objects.equals(checklist.getScope(), scope))
                .filter(checklist -> createdBy == null || Objects.equals(checklist.getCreatedBy(), createdBy))
                .toList();
    }

    @PostMapping("/checklists")
    @ResponseStatus(HttpStatus.CREATED)
    public AppChecklist createChecklist(@RequestBody AppChecklist checklist) {
        if (clean(checklist.getTitle()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o tema do checklist.");
        }
        if (!List.of("group", "individual").contains(clean(checklist.getScope()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escopo do checklist invalido.");
        }
        if (clean(checklist.getCreatedBy()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Checklist precisa de um criador.");
        }
        String now = java.time.Instant.now().toString();
        checklist.setId(UUID.randomUUID().toString());
        checklist.setTitle(clean(checklist.getTitle()));
        checklist.setScope(clean(checklist.getScope()));
        checklist.setCreatedBy(clean(checklist.getCreatedBy()));
        checklist.setCreatedAt(now);
        checklist.setUpdatedAt(now);
        AppChecklist saved = checklistRepository.save(checklist);
        publishChecklistChanged(saved, "created");
        return saved;
    }

    @PutMapping("/checklists/{id}")
    public AppChecklist updateChecklist(@PathVariable String id, @RequestBody AppChecklist update) {
        AppChecklist checklist = checklistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String title = clean(update.getTitle());
        if (title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o tema do checklist.");
        }
        checklist.setTitle(title);
        checklist.setUpdatedAt(java.time.Instant.now().toString());
        AppChecklist saved = checklistRepository.save(checklist);
        publishChecklistChanged(saved, "updated");
        return saved;
    }

    @DeleteMapping("/checklists/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteChecklist(@PathVariable String id, @RequestParam(required = false) String deletedBy) {
        AppChecklist checklist = checklistRepository.findById(id).orElse(null);
        checklistItemRepository.deleteByChecklistId(id);
        checklistRepository.deleteById(id);
        if (checklist != null) {
            publishChecklistDeleted(checklist, clean(deletedBy));
        }
    }

    @GetMapping("/checklist-items")
    public List<AppChecklistItem> checklistItems(String checklistIds) {
        List<String> ids = checklistIds == null || checklistIds.isBlank() ? List.of() : List.of(checklistIds.split(","));
        if (ids.isEmpty()) {
            return List.of();
        }
        return checklistItemRepository.findByChecklistIdInOrderByPositionAscCreatedAtAsc(ids);
    }

    @PostMapping("/checklist-items")
    @ResponseStatus(HttpStatus.CREATED)
    public List<AppChecklistItem> createChecklistItems(@RequestBody List<AppChecklistItem> rows) {
        String now = java.time.Instant.now().toString();
        List<AppChecklistItem> items = rows.stream()
                .filter(item -> !clean(item.getChecklistId()).isBlank())
                .filter(item -> !clean(item.getTitle()).isBlank())
                .map(item -> {
                    item.setId(UUID.randomUUID().toString());
                    item.setChecklistId(clean(item.getChecklistId()));
                    item.setTitle(clean(item.getTitle()));
                    item.setDone(false);
                    item.setCompletedBy(null);
                    item.setCompletedAt(null);
                    item.setCreatedAt(now);
                    return item;
                })
                .toList();
        List<AppChecklistItem> saved = checklistItemRepository.saveAll(items);
        saved.stream()
                .map(AppChecklistItem::getChecklistId)
                .distinct()
                .forEach(checklistId -> {
                    touchChecklist(checklistId);
                    publishChecklistChanged(checklistId);
                });
        return saved;
    }

    @PutMapping("/checklist-items/{id}")
    @Transactional
    public AppChecklistItem updateChecklistItem(@PathVariable String id, @RequestBody ChecklistItemUpdateRequest update) {
        AppChecklistItem item = checklistItemRepository.findLockedById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean completedNow = false;
        if (update.title() != null) {
            String title = clean(update.title());
            if (title.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a subatividade.");
            }
            item.setTitle(title);
        }
        if (update.done() != null) {
            String completedBy = clean(update.completed_by());
            if (update.done()) {
                if (completedBy.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe quem concluiu a subatividade.");
                }
                if (item.isDone()) {
                    if (!Objects.equals(item.getCompletedBy(), completedBy)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa subatividade ja foi concluida por outra pessoa.");
                    }
                } else {
                    item.setDone(true);
                    item.setCompletedBy(completedBy);
                    item.setCompletedAt(java.time.Instant.now().toString());
                    completedNow = true;
                }
            } else {
                if (item.isDone() && !Objects.equals(item.getCompletedBy(), completedBy)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Essa subatividade ja foi concluida por outra pessoa.");
                }
                item.setDone(false);
                item.setCompletedBy(null);
                item.setCompletedAt(null);
            }
        }
        touchChecklist(item.getChecklistId());
        AppChecklistItem saved = checklistItemRepository.save(item);
        if (completedNow) {
            publishChecklistItemCompleted(saved);
        } else {
            publishChecklistChanged(saved.getChecklistId());
        }
        return saved;
    }

    @DeleteMapping("/checklist-items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteChecklistItem(@PathVariable String id) {
        checklistItemRepository.findById(id).ifPresent(item -> {
            checklistItemRepository.delete(item);
            touchChecklist(item.getChecklistId());
            publishChecklistChanged(item.getChecklistId());
        });
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
        if (clean(note.getTitle()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o titulo da anotacao.");
        }
        if (!List.of("general", "individual").contains(clean(note.getScope()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escopo da anotacao invalido.");
        }
        if (clean(note.getUserId()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Anotacao precisa de um autor.");
        }
        note.setId(UUID.randomUUID().toString());
        String now = java.time.Instant.now().toString();
        note.setTitle(clean(note.getTitle()));
        note.setContent(clean(note.getContent()).isBlank() ? null : clean(note.getContent()));
        note.setScope(clean(note.getScope()));
        note.setUserId(clean(note.getUserId()));
        note.setCreatedAt(now);
        note.setUpdatedAt(now);
        AppNote saved = noteRepository.save(note);
        publishNoteChanged(saved, "created");
        return saved;
    }

    @PutMapping("/notes/{id}")
    public AppNote updateNote(@PathVariable String id, @RequestBody AppNote update) {
        AppNote note = noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (clean(update.getTitle()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o titulo da anotacao.");
        }
        note.setTitle(clean(update.getTitle()));
        note.setContent(clean(update.getContent()).isBlank() ? null : clean(update.getContent()));
        note.setUpdatedAt(java.time.Instant.now().toString());
        AppNote saved = noteRepository.save(note);
        publishNoteChanged(saved, "updated");
        return saved;
    }

    @DeleteMapping("/notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(@PathVariable String id, @RequestParam(required = false) String deletedBy) {
        AppNote note = noteRepository.findById(id).orElse(null);
        noteRepository.deleteById(id);
        if (note != null) {
            publishNoteDeleted(note, clean(deletedBy));
        }
    }

    @GetMapping("/alerts")
    public List<AppAlert> alerts() {
        return alertRepository.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping("/alerts")
    @ResponseStatus(HttpStatus.CREATED)
    public AppAlert createAlert(@RequestBody AppAlert alert) {
        if (clean(alert.getTitle()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o titulo do alerta.");
        }
        if (clean(alert.getMessage()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a mensagem do alerta.");
        }
        if (clean(alert.getUserId()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alerta precisa de um autor.");
        }
        String priority = clean(alert.getPriority()).isBlank() ? "normal" : clean(alert.getPriority());
        if (!List.of("low", "normal", "high").contains(priority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prioridade do alerta invalida.");
        }
        alert.setId(UUID.randomUUID().toString());
        alert.setTitle(clean(alert.getTitle()));
        alert.setMessage(clean(alert.getMessage()));
        alert.setPriority(priority);
        alert.setUserId(clean(alert.getUserId()));
        alert.setCreatedAt(java.time.Instant.now().toString());
        AppAlert saved = alertRepository.save(alert);
        publishAlertCreated(saved);
        return saved;
    }

    @DeleteMapping("/alerts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAlert(@PathVariable String id, @RequestParam(required = false) String deletedBy) {
        AppAlert alert = alertRepository.findById(id).orElse(null);
        alertRepository.deleteById(id);
        if (alert != null) {
            publishAlertDeleted(alert, clean(deletedBy));
        }
    }

    @PutMapping("/alerts/{id}")
    public AppAlert updateAlert(@PathVariable String id, @RequestBody AppAlert update) {
        AppAlert alert = alertRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerta nao encontrado."));
        if (clean(update.getTitle()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o titulo do alerta.");
        }
        if (clean(update.getMessage()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a mensagem do alerta.");
        }
        String priority = clean(update.getPriority()).isBlank() ? "normal" : clean(update.getPriority());
        if (!List.of("low", "normal", "high").contains(priority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prioridade do alerta invalida.");
        }
        alert.setTitle(clean(update.getTitle()));
        alert.setMessage(clean(update.getMessage()));
        alert.setPriority(priority);
        AppAlert saved = alertRepository.save(alert);
        publishAlertUpdated(saved);
        return saved;
    }

    @GetMapping("/tutorials")
    public List<AppTutorial> tutorials() {
        return tutorialRepository.findAll();
    }

    @PostMapping(value = "/tutorials", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AppTutorial createTutorial(@RequestBody AppTutorial tutorial) {
        if (clean(tutorial.getTitle()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o titulo do tutorial.");
        }
        if (clean(tutorial.getUserId()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tutorial precisa de um autor.");
        }
        tutorial.setId(UUID.randomUUID().toString());
        tutorial.setTitle(clean(tutorial.getTitle()));
        tutorial.setContent(clean(tutorial.getContent()).isBlank() ? null : clean(tutorial.getContent()));
        tutorial.setUrl(clean(tutorial.getUrl()).isBlank() ? null : clean(tutorial.getUrl()));
        tutorial.setUserId(clean(tutorial.getUserId()));
        tutorial.setCreatedAt(java.time.Instant.now().toString());
        AppTutorial saved = tutorialRepository.save(tutorial);
        publishTutorialChanged(saved, "created");
        return saved;
    }

    @PostMapping(value = "/tutorials", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AppTutorial createTutorialWithFile(
            @RequestParam String title,
            @RequestParam(required = false) String content,
            @RequestParam(required = false) String url,
            @RequestParam String user_id,
            @RequestPart("file") MultipartFile file) throws IOException {
        if (clean(title).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o titulo do tutorial.");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um arquivo para anexar.");
        }

        StoredFile storedFile = storeUploadedFile(file);

        AppTutorial tutorial = new AppTutorial();
        tutorial.setId(UUID.randomUUID().toString());
        tutorial.setTitle(clean(title));
        tutorial.setContent(clean(content).isBlank() ? null : clean(content));
        tutorial.setUrl(clean(url).isBlank() ? null : clean(url));
        tutorial.setUserId(clean(user_id));
        tutorial.setFileName(storedFile.fileName());
        tutorial.setFileUrl(storedFile.fileUrl());
        tutorial.setMimeType(storedFile.mimeType());
        tutorial.setCreatedAt(java.time.Instant.now().toString());
        AppTutorial saved = tutorialRepository.save(tutorial);
        publishTutorialChanged(saved, "created");
        return saved;
    }

    @PutMapping(value = "/tutorials/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AppTutorial updateTutorial(@PathVariable String id, @RequestBody AppTutorial update) {
        AppTutorial tutorial = tutorialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tutorial nao encontrado."));
        updateTutorialFields(tutorial, clean(update.getTitle()), update.getContent(), update.getUrl());
        AppTutorial saved = tutorialRepository.save(tutorial);
        publishTutorialChanged(saved, "updated");
        return saved;
    }

    @PutMapping(value = "/tutorials/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AppTutorial updateTutorialWithFile(
            @PathVariable String id,
            @RequestParam String title,
            @RequestParam(required = false) String content,
            @RequestParam(required = false) String url,
            @RequestPart("file") MultipartFile file) throws IOException {
        AppTutorial tutorial = tutorialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tutorial nao encontrado."));
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um arquivo para anexar.");
        }
        StoredFile storedFile = storeUploadedFile(file);
        updateTutorialFields(tutorial, title, content, url);
        tutorial.setFileName(storedFile.fileName());
        tutorial.setFileUrl(storedFile.fileUrl());
        tutorial.setMimeType(storedFile.mimeType());
        AppTutorial saved = tutorialRepository.save(tutorial);
        publishTutorialChanged(saved, "updated");
        return saved;
    }

    @DeleteMapping("/tutorials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTutorial(@PathVariable String id, @RequestParam(required = false) String deletedBy) {
        AppTutorial tutorial = tutorialRepository.findById(id).orElse(null);
        tutorialRepository.deleteById(id);
        if (tutorial != null) {
            publishTutorialDeleted(tutorial, clean(deletedBy));
        }
    }

    @GetMapping("/conversations")
    public List<Conversation> conversations(String userId) {
        if (clean(userId).isBlank()) {
            return conversationRepository.findAll().stream()
                    .sorted(Comparator.comparing(Conversation::getCreatedAt).reversed())
                    .toList();
        }
        return conversationRepository.findByParticipantIdsContainingOrderByCreatedAtDesc(userId);
    }

    @GetMapping("/users/{userId}/events")
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter subscribeToUser(@PathVariable String userId) {
        return conversationSseService.subscribeToUser(userId);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public List<ConversationMessage> messages(@PathVariable String conversationId) {
        return conversationMessageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationMessage createMessage(@PathVariable String conversationId, @RequestBody MessageCreateRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversa nao encontrada."));
        if (!conversation.getParticipantIds().contains(clean(request.sender_id()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario nao participa da conversa.");
        }
        ConversationMessage message = new ConversationMessage();
        message.setId(UUID.randomUUID().toString());
        message.setConversationId(conversationId);
        message.setSenderId(clean(request.sender_id()));
        message.setContent(normalizeMessageContent(request.content(), true));
        message.setCreatedAt(java.time.Instant.now().toString());
        ConversationMessage saved = conversationMessageRepository.save(message);
        publishMessage(conversation, saved);
        return saved;
    }

    @PostMapping("/conversations/{conversationId}/typing")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void publishTyping(@PathVariable String conversationId, @RequestBody TypingRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversa nao encontrada."));
        String userId = clean(request.user_id());
        if (!conversation.getParticipantIds().contains(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario nao participa da conversa.");
        }
        conversationSseService.publishTyping(conversationId, Map.of(
                "conversationId", conversationId,
                "userId", userId,
                "typing", Boolean.TRUE.equals(request.typing())
        ));
    }

    @PostMapping(value = "/conversations/{conversationId}/messages/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationMessage createMessageWithFile(
            @PathVariable String conversationId,
            @RequestParam String sender_id,
            @RequestParam(required = false) String content,
            @RequestPart("file") MultipartFile file) throws IOException {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversa nao encontrada."));
        if (!conversation.getParticipantIds().contains(clean(sender_id))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario nao participa da conversa.");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um arquivo para enviar.");
        }

        StoredFile storedFile = storeUploadedFile(file);

        ConversationMessage message = new ConversationMessage();
        message.setId(UUID.randomUUID().toString());
        message.setConversationId(conversationId);
        message.setSenderId(clean(sender_id));
        message.setContent(normalizeMessageContent(content, false));
        message.setFileName(storedFile.fileName());
        message.setFileUrl(storedFile.fileUrl());
        message.setMimeType(storedFile.mimeType());
        message.setCreatedAt(java.time.Instant.now().toString());
        ConversationMessage saved = conversationMessageRepository.save(message);
        publishMessage(conversation, saved);
        return saved;
    }

    @GetMapping("/files/{fileName:.+}")
    public ResponseEntity<Resource> getFile(@PathVariable String fileName) throws IOException {
        AppFile appFile = fileRepository.findById(fileName).orElse(null);
        if (appFile != null) {
            String contentType = appFile.getMimeType() == null || appFile.getMimeType().isBlank()
                    ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                    : appFile.getMimeType();
            Resource resource = new ByteArrayResource(appFile.getFileData());
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .contentLength(appFile.getFileSize() == null ? appFile.getFileData().length : appFile.getFileSize())
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + appFile.getFileName() + "\"")
                    .body(resource);
        }

        Path targetPath = CHAT_UPLOAD_ROOT.resolve(fileName).normalize();
        if (!targetPath.startsWith(CHAT_UPLOAD_ROOT) || !Files.exists(targetPath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Arquivo nao encontrado.");
        }

        Resource resource = new UrlResource(targetPath.toUri());
        String contentType = Files.probeContentType(targetPath);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + targetPath.getFileName() + "\"")
                .body(resource);
    }

    @GetMapping("/conversations/{conversationId}/events")
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter subscribeToConversation(@PathVariable String conversationId) {
        return conversationSseService.subscribe(conversationId);
    }

    @DeleteMapping("/conversations/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteConversation(@PathVariable String conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversa nao encontrada."));
        conversationMessageRepository.deleteByConversationId(conversationId);
        conversationRepository.deleteById(conversationId);
        for (String participantId : conversation.getParticipantIds()) {
            try {
                conversationSseService.publishUserEvent(participantId, "deletedConversation", conversationId);
            } catch (Exception e) {
                // ignore publish failures
            }
        }
    }

    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public Conversation createConversation(@RequestBody ConversationCreateRequest request) {
        if (clean(request.created_by()).isBlank() || request.participant_ids() == null || request.participant_ids().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conversa precisa de criador e participantes.");
        }
        List<String> participants = request.participant_ids().stream().map(this::clean).filter(item -> !item.isBlank()).distinct().toList();
        if (!participants.contains(clean(request.created_by()))) {
            participants = Stream.concat(Stream.of(clean(request.created_by())), participants.stream()).distinct().toList();
        }
        Conversation conversation = new Conversation();
        conversation.setId(UUID.randomUUID().toString());
        conversation.setCreatedBy(clean(request.created_by()));
        conversation.setType(clean(request.type()).isBlank() ? "direct" : clean(request.type()));
        conversation.setTitle(clean(request.title()));
        conversation.setParticipantIds(participants);
        conversation.setCreatedAt(java.time.Instant.now().toString());
        Conversation saved = conversationRepository.save(conversation);
        for (String participantId : participants) {
            if (!participantId.equals(saved.getCreatedBy())) {
                try {
                    conversationSseService.publishUserEvent(participantId, "newConversation", saved);
                } catch (Exception e) {
                    // ignore
                }
            }
        }
        return saved;
    }

    private void publishMessage(Conversation conversation, ConversationMessage saved) {
        try {
            conversationSseService.publishMessage(conversation.getId(), saved);
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
        for (String participantId : conversation.getParticipantIds()) {
            if (!participantId.equals(saved.getSenderId())) {
                try {
                    conversationSseService.publishUserEvent(participantId, "newMessage", Map.of(
                        "conversationId", conversation.getId(),
                        "message", saved
                    ));
                } catch (Exception e) {
                    // don't fail the request if publishing fails
                }
            }
        }
    }

    private StoredFile storeUploadedFile(MultipartFile file) throws IOException {
        String sanitizedFileName = clean(file.getOriginalFilename()).replaceAll("[^a-zA-Z0-9._-]", "_");
        if (sanitizedFileName.isBlank()) {
            sanitizedFileName = "arquivo";
        }
        String mimeType = file.getContentType() == null || file.getContentType().isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : file.getContentType();

        AppFile appFile = new AppFile();
        appFile.setId(UUID.randomUUID().toString());
        appFile.setFileName(sanitizedFileName);
        appFile.setMimeType(mimeType);
        appFile.setFileSize(file.getSize());
        appFile.setFileData(file.getBytes());
        appFile.setCreatedAt(java.time.Instant.now().toString());
        AppFile saved = fileRepository.save(appFile);

        return new StoredFile(sanitizedFileName, "/files/" + saved.getId(), mimeType);
    }

    private UserResponse toUserResponse(AppUser user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getPhotoUrl());
    }

    private Profile profileForUser(AppUser user) {
        return profileRepository.findById(user.getId()).orElseGet(() -> {
            Profile created = new Profile();
            created.setId(user.getId());
            created.setDisplayName(user.getDisplayName());
            created.setPhotoUrl(user.getPhotoUrl());
            return created;
        });
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeMessageContent(String value, boolean required) {
        String content = clean(value);
        if (required && content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mensagem vazia.");
        }
        if (content.length() > ConversationMessage.MAX_CONTENT_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mensagem muito longa. Envie ate " + ConversationMessage.MAX_CONTENT_LENGTH + " caracteres."
            );
        }
        return content;
    }

    private void updateTutorialFields(AppTutorial tutorial, String title, String content, String url) {
        if (clean(title).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o titulo do tutorial.");
        }
        tutorial.setTitle(clean(title));
        tutorial.setContent(clean(content).isBlank() ? null : clean(content));
        tutorial.setUrl(clean(url).isBlank() ? null : clean(url));
    }

    private void migrateChatMessageContentColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE IF EXISTS chat_messages ALTER COLUMN content TYPE text");
        } catch (Exception ignored) {
            try {
                jdbcTemplate.execute("ALTER TABLE chat_messages ALTER COLUMN content CHARACTER VARYING(" + ConversationMessage.MAX_CONTENT_LENGTH + ")");
            } catch (Exception ignoredAgain) {
                // Hibernate creates the column for fresh databases; this only widens existing schemas when possible.
            }
        }
    }

    private void touchChecklist(String checklistId) {
        checklistRepository.findById(checklistId).ifPresent(checklist -> {
            checklist.setUpdatedAt(java.time.Instant.now().toString());
            checklistRepository.save(checklist);
        });
    }

    private void publishChecklistChanged(String checklistId) {
        checklistRepository.findById(checklistId).ifPresent(this::publishChecklistChanged);
    }

    private void publishChecklistChanged(AppChecklist checklist) {
        publishChecklistChanged(checklist, "changed");
    }

    private void publishChecklistChanged(AppChecklist checklist, String action) {
        publishChecklistChanged(checklist.getId(), checklist.getScope(), action, checklist.getTitle(), checklist.getCreatedBy());
    }

    private void publishChecklistChanged(String checklistId, String scope) {
        publishChecklistChanged(checklistId, scope, "changed", "", "");
    }

    private void publishChecklistChanged(String checklistId, String scope, String action, String title, String createdBy) {
        if (!Objects.equals(scope, "group")) {
            return;
        }
        try {
            conversationSseService.publishGlobalUserEvent("checklistChanged", Map.of(
                    "checklistId", checklistId,
                    "scope", scope,
                    "action", action,
                    "title", clean(title),
                    "createdBy", clean(createdBy)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishChecklistDeleted(AppChecklist checklist, String deletedBy) {
        if (!Objects.equals(checklist.getScope(), "group")) {
            return;
        }
        try {
            conversationSseService.publishGlobalUserEvent("checklistChanged", Map.of(
                    "checklistId", checklist.getId(),
                    "scope", checklist.getScope(),
                    "action", "deleted",
                    "title", clean(checklist.getTitle()),
                    "deletedBy", deletedBy,
                    "deletedByName", profileName(deletedBy)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishChecklistItemCompleted(AppChecklistItem item) {
        checklistRepository.findById(item.getChecklistId()).ifPresent(checklist -> {
            if (!Objects.equals(checklist.getScope(), "group")) {
                return;
            }
            String completedBy = clean(item.getCompletedBy());
            try {
                conversationSseService.publishGlobalUserEvent("checklistChanged", Map.of(
                        "checklistId", checklist.getId(),
                        "scope", checklist.getScope(),
                        "action", "itemCompleted",
                        "title", clean(checklist.getTitle()),
                        "itemId", item.getId(),
                        "itemTitle", clean(item.getTitle()),
                        "completedBy", completedBy,
                        "completedByName", profileName(completedBy)
                ));
            } catch (Exception e) {
                // don't fail the request if publishing fails
            }
        });
    }

    private void publishAlertCreated(AppAlert alert) {
        String userId = clean(alert.getUserId());
        try {
            conversationSseService.publishGlobalUserEvent("alertChanged", Map.of(
                    "action", "created",
                    "alertId", alert.getId(),
                    "title", clean(alert.getTitle()),
                    "priority", clean(alert.getPriority()),
                    "createdBy", userId,
                    "createdByName", profileName(userId)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishAlertUpdated(AppAlert alert) {
        String userId = clean(alert.getUserId());
        try {
            conversationSseService.publishGlobalUserEvent("alertChanged", Map.of(
                    "action", "updated",
                    "alertId", alert.getId(),
                    "title", clean(alert.getTitle()),
                    "priority", clean(alert.getPriority()),
                    "createdBy", userId,
                    "createdByName", profileName(userId)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishAlertDeleted(AppAlert alert, String deletedBy) {
        try {
            conversationSseService.publishGlobalUserEvent("alertChanged", Map.of(
                    "action", "deleted",
                    "alertId", alert.getId(),
                    "title", clean(alert.getTitle()),
                    "priority", clean(alert.getPriority()),
                    "deletedBy", deletedBy,
                    "deletedByName", profileName(deletedBy)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishNoteChanged(AppNote note, String action) {
        if (!Objects.equals(clean(note.getScope()), "general")) {
            return;
        }
        String userId = clean(note.getUserId());
        try {
            conversationSseService.publishGlobalUserEvent("noteChanged", Map.of(
                    "action", action,
                    "noteId", note.getId(),
                    "scope", clean(note.getScope()),
                    "title", clean(note.getTitle()),
                    "createdBy", userId,
                    "createdByName", profileName(userId)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishNoteDeleted(AppNote note, String deletedBy) {
        if (!Objects.equals(clean(note.getScope()), "general")) {
            return;
        }
        try {
            conversationSseService.publishGlobalUserEvent("noteChanged", Map.of(
                    "action", "deleted",
                    "noteId", note.getId(),
                    "scope", clean(note.getScope()),
                    "title", clean(note.getTitle()),
                    "deletedBy", deletedBy,
                    "deletedByName", profileName(deletedBy)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishTaskChanged(String taskId) {
        taskRepository.findById(clean(taskId)).ifPresent(task -> publishTaskChanged(task, "changed"));
    }

    private void publishTaskChanged(Task task, String action) {
        if (!Objects.equals(clean(task.getScope()), "group")) {
            return;
        }
        String createdBy = clean(task.getCreatedBy());
        try {
            conversationSseService.publishGlobalUserEvent("taskChanged", Map.of(
                    "action", action,
                    "taskId", task.getId(),
                    "scope", clean(task.getScope()),
                    "title", clean(task.getTitle()),
                    "taskDate", clean(task.getTaskDate()),
                    "done", task.isDone(),
                    "createdBy", createdBy,
                    "createdByName", profileName(createdBy)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishTaskDeleted(Task task, String deletedBy) {
        if (!Objects.equals(clean(task.getScope()), "group")) {
            return;
        }
        try {
            conversationSseService.publishGlobalUserEvent("taskChanged", Map.of(
                    "action", "deleted",
                    "taskId", task.getId(),
                    "scope", clean(task.getScope()),
                    "title", clean(task.getTitle()),
                    "taskDate", clean(task.getTaskDate()),
                    "deletedBy", deletedBy,
                    "deletedByName", profileName(deletedBy)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishTutorialChanged(AppTutorial tutorial, String action) {
        String userId = clean(tutorial.getUserId());
        try {
            conversationSseService.publishGlobalUserEvent("tutorialChanged", Map.of(
                    "action", action,
                    "tutorialId", tutorial.getId(),
                    "title", clean(tutorial.getTitle()),
                    "createdBy", userId,
                    "createdByName", profileName(userId)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private void publishTutorialDeleted(AppTutorial tutorial, String deletedBy) {
        try {
            conversationSseService.publishGlobalUserEvent("tutorialChanged", Map.of(
                    "action", "deleted",
                    "tutorialId", tutorial.getId(),
                    "title", clean(tutorial.getTitle()),
                    "deletedBy", deletedBy,
                    "deletedByName", profileName(deletedBy)
            ));
        } catch (Exception e) {
            // don't fail the request if publishing fails
        }
    }

    private String profileName(String userId) {
        return profileRepository.findById(clean(userId))
                .map(Profile::getDisplayName)
                .map(this::clean)
                .filter(name -> !name.isBlank())
                .orElse("Usuario");
    }

    public record AuthRequest(String email, String password, String display_name) {
    }

    public record AuthResponse(UserResponse user) {
    }

    public record UserResponse(String id, String email, String display_name, String photo_url) {
    }

    public record ProfileUpdateRequest(String email, String display_name, String password) {
    }

    public record ConversationCreateRequest(String created_by, List<String> participant_ids, String type, String title) {
    }

    public record MessageCreateRequest(String sender_id, String content) {
    }

    public record TypingRequest(String user_id, Boolean typing) {
    }

    public record ChecklistItemUpdateRequest(String title, Boolean done, String completed_by) {
    }

    private record StoredFile(String fileName, String fileUrl, String mimeType) {
    }
}
