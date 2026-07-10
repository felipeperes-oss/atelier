package br.com.atelier.app;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class JsonDataStore {

    private final ObjectMapper objectMapper;
    private final Path file;

    public JsonDataStore(ObjectMapper objectMapper, @Value("${atelier.data.file:data/atelier-data.json}") String fileName) {
        this.objectMapper = objectMapper.findAndRegisterModules();
        this.file = Path.of(fileName);
        initialize();
    }

    public synchronized AppData read() {
        try {
            if (!Files.exists(file)) {
                AppData data = initialData();
                write(data);
                return data;
            }
            return objectMapper.readValue(file.toFile(), AppData.class);
        } catch (IOException e) {
            throw new IllegalStateException("Nao foi possivel ler o arquivo JSON de dados.", e);
        }
    }

    public synchronized void write(AppData data) {
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), data);
        } catch (IOException e) {
            throw new IllegalStateException("Nao foi possivel salvar o arquivo JSON de dados.", e);
        }
    }

    public String newId() {
        return UUID.randomUUID().toString();
    }

    public String now() {
        return Instant.now().toString();
    }

    private void initialize() {
        if (!Files.exists(file)) {
            write(initialData());
        }
    }

    private AppData initialData() {
        AppData data = new AppData();

        addUser(data, "user-alessandra", "alessandra@atelier.local", "123456", "Alessandra");
        addUser(data, "user-felipe", "felipe@atelier.local", "123456", "Felipe");
        addUser(data, "user-lucas", "lucas@atelier.local", "123456", "Lucas");
        addUser(data, "user-herysson", "herysson@atelier.local", "123456", "Herysson");

        addTask(data, "task-1", "Reuniao de Equipe", null, "2026-06-09", "group", "user-felipe", false);
        addTask(data, "task-2", "HC UFMG", null, "2026-06-15", "individual", "user-lucas", false);
        addTask(data, "task-3", "Master Remoto", null, "2026-06-19", "group", "user-felipe", false);
        addTask(data, "task-4", "Apresentacao", null, "2026-06-23", "group", "user-alessandra", false);

        addAssignee(data, "task-1", "user-alessandra");
        addAssignee(data, "task-1", "user-felipe");
        addAssignee(data, "task-2", "user-lucas");
        addAssignee(data, "task-3", "user-felipe");
        addAssignee(data, "task-3", "user-alessandra");
        addAssignee(data, "task-4", "user-alessandra");
        addAssignee(data, "task-4", "user-herysson");

        addNote(data, "note-1", "Anotacoes gerais", "Espaco para registrar pontos gerais da equipe.", "general", "user-felipe");
        addNote(data, "note-2", "Anotacoes individuais", "Espaco para observacoes individuais.", "individual", "user-felipe");

        addAlert(data, "alert-1", "Revisar agenda da semana", "Conferir eventos e responsaveis antes da reuniao.", "normal", "user-felipe");
        addTutorial(data, "tutorial-1", "Fluxo do calendario", "Cadastrar eventos com data, tipo e participantes.", null, "user-felipe");

        return data;
    }

    private void addUser(AppData data, String id, String email, String password, String displayName) {
        AppData.AppUser user = new AppData.AppUser();
        user.id = id;
        user.email = email;
        user.password = password;
        user.display_name = displayName;
        data.users.add(user);

        AppData.Profile profile = new AppData.Profile();
        profile.id = id;
        profile.display_name = displayName;
        data.profiles.add(profile);
    }

    private void addTask(AppData data, String id, String title, String description, String date, String scope, String userId, boolean done) {
        AppData.Task task = new AppData.Task();
        task.id = id;
        task.title = title;
        task.description = description;
        task.task_date = date;
        task.scope = scope;
        task.created_by = userId;
        task.done = done;
        task.created_at = now();
        data.tasks.add(task);
    }

    private void addAssignee(AppData data, String taskId, String userId) {
        AppData.TaskAssignee assignee = new AppData.TaskAssignee();
        assignee.task_id = taskId;
        assignee.user_id = userId;
        data.task_assignees.add(assignee);
    }

    private void addNote(AppData data, String id, String title, String content, String scope, String userId) {
        AppData.AppNote note = new AppData.AppNote();
        note.id = id;
        note.title = title;
        note.content = content;
        note.scope = scope;
        note.user_id = userId;
        note.created_at = now();
        note.updated_at = note.created_at;
        data.notes.add(note);
    }

    private void addAlert(AppData data, String id, String title, String message, String priority, String userId) {
        AppData.AppAlert alert = new AppData.AppAlert();
        alert.id = id;
        alert.title = title;
        alert.message = message;
        alert.priority = priority;
        alert.user_id = userId;
        alert.created_at = now();
        data.alerts.add(alert);
    }

    private void addTutorial(AppData data, String id, String title, String content, String url, String userId) {
        AppData.AppTutorial tutorial = new AppData.AppTutorial();
        tutorial.id = id;
        tutorial.title = title;
        tutorial.content = content;
        tutorial.url = url;
        tutorial.user_id = userId;
        tutorial.created_at = now();
        data.tutorials.add(tutorial);
    }
}
