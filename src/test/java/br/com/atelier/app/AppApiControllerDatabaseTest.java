package br.com.atelier.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AppApiControllerDatabaseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private ProfileRepository profileRepository;

    @Autowired
    private AppFileRepository fileRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskAssigneeRepository taskAssigneeRepository;

    @Autowired
    private AppChecklistRepository checklistRepository;

    @Autowired
    private AppChecklistItemRepository checklistItemRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        taskAssigneeRepository.deleteAll();
        taskRepository.deleteAll();
        checklistItemRepository.deleteAll();
        checklistRepository.deleteAll();
        fileRepository.deleteAll();
        profileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void signupPersistsUserAndProfileInDatabase() throws Exception {
        String body = """
                {
                  "email": "john@example.com",
                  "password": "123456",
                  "display_name": "John"
                }
                """;

        mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value("john@example.com"));

        assertThat(userRepository.count()).isEqualTo(1);
        assertThat(profileRepository.count()).isEqualTo(1);
    }

    @Test
    void signupRejectsBlankDisplayName() throws Exception {
        String body = """
                {
                  "email": "john@example.com",
                  "password": "123456",
                  "display_name": "   "
                }
                """;

        mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.count()).isZero();
        assertThat(profileRepository.count()).isZero();
    }

    @Test
    void profilesIgnoreBlankAndOrphanRows() throws Exception {
        String alice = """
                {
                  "email": "alice@example.com",
                  "password": "123456",
                  "display_name": "Alice"
                }
                """;

        mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(alice))
                .andExpect(status().isCreated());

        AppUser blankNameUser = new AppUser();
        blankNameUser.setId(java.util.UUID.randomUUID().toString());
        blankNameUser.setEmail("blank@example.com");
        blankNameUser.setPassword("123456");
        blankNameUser.setDisplayName("Blank");
        userRepository.save(blankNameUser);

        Profile blankNameProfile = new Profile();
        blankNameProfile.setId(blankNameUser.getId());
        blankNameProfile.setDisplayName("   ");
        profileRepository.save(blankNameProfile);

        Profile orphanProfile = new Profile();
        orphanProfile.setId(java.util.UUID.randomUUID().toString());
        orphanProfile.setDisplayName("Usuario removido");
        profileRepository.save(orphanProfile);

        mockMvc.perform(get("/api/app/profiles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].display_name").value("Alice"))
                .andExpect(jsonPath("$[1]").doesNotExist());
    }

    @Test
    void canCreateConversationAndSendMessages() throws Exception {
        String alice = """
                {
                  "email": "alice@example.com",
                  "password": "123456",
                  "display_name": "Alice"
                }
                """;
        String bob = """
                {
                  "email": "bob@example.com",
                  "password": "123456",
                  "display_name": "Bob"
                }
                """;

        String aliceResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(alice))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String bobResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(bob))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode aliceJson = objectMapper.readTree(aliceResponse);
        JsonNode bobJson = objectMapper.readTree(bobResponse);
        String aliceIdFromJson = aliceJson.get("user").get("id").asText();
        String bobIdFromJson = bobJson.get("user").get("id").asText();

        String conversationBody = """
                {
                  "created_by": "%s",
                  "participant_ids": ["%s", "%s"],
                  "type": "direct"
                }
                """.formatted(aliceIdFromJson, aliceIdFromJson, bobIdFromJson);

        String conversationResponse = mockMvc.perform(post("/api/app/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(conversationBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        JsonNode conversationJson = objectMapper.readTree(conversationResponse);
        String conversationId = conversationJson.get("id").asText();

        mockMvc.perform(post("/api/app/conversations/" + conversationId + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sender_id\":\"" + aliceIdFromJson + "\",\"content\":\"Olá Bob\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("Olá Bob"));

        String longMessage = "a".repeat(300);
        mockMvc.perform(post("/api/app/conversations/" + conversationId + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "sender_id", aliceIdFromJson,
                        "content", longMessage
                ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value(longMessage));

        String oversizedMessage = "a".repeat(ConversationMessage.MAX_CONTENT_LENGTH + 1);
        mockMvc.perform(post("/api/app/conversations/" + conversationId + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "sender_id", aliceIdFromJson,
                        "content", oversizedMessage
                ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Mensagem muito longa. Envie ate " + ConversationMessage.MAX_CONTENT_LENGTH + " caracteres."));

        mockMvc.perform(get("/api/app/conversations").param("userId", aliceIdFromJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(conversationId));
    }

    @Test
    void canUploadAttachmentToConversationMessage() throws Exception {
        String alice = """
                {
                  "email": "alice@example.com",
                  "password": "123456",
                  "display_name": "Alice"
                }
                """;
        String bob = """
                {
                  "email": "bob@example.com",
                  "password": "123456",
                  "display_name": "Bob"
                }
                """;

        String aliceResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(alice))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String bobResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(bob))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode aliceJson = objectMapper.readTree(aliceResponse);
        JsonNode bobJson = objectMapper.readTree(bobResponse);
        String aliceIdFromJson = aliceJson.get("user").get("id").asText();
        String bobIdFromJson = bobJson.get("user").get("id").asText();

        String conversationBody = """
                {
                  "created_by": "%s",
                  "participant_ids": ["%s", "%s"],
                  "type": "direct"
                }
                """.formatted(aliceIdFromJson, aliceIdFromJson, bobIdFromJson);

        String conversationResponse = mockMvc.perform(post("/api/app/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(conversationBody))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        JsonNode conversationJson = objectMapper.readTree(conversationResponse);
        String conversationId = conversationJson.get("id").asText();

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.png",
                MediaType.IMAGE_PNG_VALUE,
                "fake-image-data".getBytes()
        );

        String messageResponse = mockMvc.perform(multipart("/api/app/conversations/" + conversationId + "/messages/file")
                .file(file)
                .param("sender_id", aliceIdFromJson)
                .param("content", "Aqui vai a imagem"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.file_name").value("avatar.png"))
                .andExpect(jsonPath("$.mime_type").value("image/png"))
                .andExpect(jsonPath("$.file_url").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        assertThat(fileRepository.count()).isEqualTo(1);

        JsonNode messageJson = objectMapper.readTree(messageResponse);
        String fileUrl = messageJson.get("file_url").asText();
        byte[] fileBytes = mockMvc.perform(get("/api/app" + fileUrl))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(fileBytes).isEqualTo("fake-image-data".getBytes());
    }

    @Test
    void canDeleteTaskWithAssignees() throws Exception {
        String alice = """
                {
                  "email": "alice@example.com",
                  "password": "123456",
                  "display_name": "Alice"
                }
                """;
        String bob = """
                {
                  "email": "bob@example.com",
                  "password": "123456",
                  "display_name": "Bob"
                }
                """;

        String aliceResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(alice))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String bobResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(bob))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String aliceId = objectMapper.readTree(aliceResponse).get("user").get("id").asText();
        String bobId = objectMapper.readTree(bobResponse).get("user").get("id").asText();

        String taskBody = """
                {
                  "title": "Pagar conta",
                  "description": "Conta do mes",
                  "task_date": "2026-07-15",
                  "scope": "group",
                  "done": false,
                  "created_by": "%s"
                }
                """.formatted(aliceId);

        String taskResponse = mockMvc.perform(post("/api/app/tasks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(taskBody))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String taskId = objectMapper.readTree(taskResponse).get("id").asText();

        String assigneeBody = """
                [
                  {
                    "task_id": "%s",
                    "user_id": "%s"
                  }
                ]
                """.formatted(taskId, bobId);
        mockMvc.perform(post("/api/app/task-assignees")
                .contentType(MediaType.APPLICATION_JSON)
                .content(assigneeBody))
                .andExpect(status().isCreated());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/app/tasks/" + taskId))
                .andExpect(status().isNoContent());

        assertThat(taskRepository.findById(taskId)).isEmpty();
        assertThat(taskAssigneeRepository.findByTaskIdIn(java.util.List.of(taskId))).isEmpty();
    }

    @Test
    void canCreateAndCompleteChecklistItem() throws Exception {
        String alice = """
                {
                  "email": "alice@example.com",
                  "password": "123456",
                  "display_name": "Alice"
                }
                """;
        String bob = """
                {
                  "email": "bob@example.com",
                  "password": "123456",
                  "display_name": "Bob"
                }
                """;

        String aliceResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(alice))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String bobResponse = mockMvc.perform(post("/api/app/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(bob))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String aliceId = objectMapper.readTree(aliceResponse).get("user").get("id").asText();
        String bobId = objectMapper.readTree(bobResponse).get("user").get("id").asText();

        String checklistBody = """
                {
                  "title": "Organizar evento",
                  "scope": "group",
                  "created_by": "%s"
                }
                """.formatted(aliceId);

        String checklistResponse = mockMvc.perform(post("/api/app/checklists")
                .contentType(MediaType.APPLICATION_JSON)
                .content(checklistBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Organizar evento"))
                .andReturn().getResponse().getContentAsString();
        String checklistId = objectMapper.readTree(checklistResponse).get("id").asText();

        String itemsBody = """
                [
                  {
                    "checklist_id": "%s",
                    "title": "Comprar materiais",
                    "position": 0
                  }
                ]
                """.formatted(checklistId);

        String itemsResponse = mockMvc.perform(post("/api/app/checklist-items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(itemsBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].title").value("Comprar materiais"))
                .andReturn().getResponse().getContentAsString();
        String itemId = objectMapper.readTree(itemsResponse).get(0).get("id").asText();

        String updateBody = """
                {
                  "done": true,
                  "completed_by": "%s"
                }
                """.formatted(aliceId);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/app/checklist-items/" + itemId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.done").value(true))
                .andExpect(jsonPath("$.completed_by").value(aliceId))
                .andExpect(jsonPath("$.completed_at").isNotEmpty());

        String bobUpdateBody = """
                {
                  "done": true,
                  "completed_by": "%s"
                }
                """.formatted(bobId);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/app/checklist-items/" + itemId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(bobUpdateBody))
                .andExpect(status().isConflict());

        assertThat(checklistRepository.count()).isEqualTo(1);
        assertThat(checklistItemRepository.count()).isEqualTo(1);
        AppChecklistItem savedItem = checklistItemRepository.findById(itemId).orElseThrow();
        assertThat(savedItem.getCompletedBy()).isEqualTo(aliceId);
    }
}
