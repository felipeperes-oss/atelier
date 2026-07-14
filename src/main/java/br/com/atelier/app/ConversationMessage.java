package br.com.atelier.app;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "chat_messages")
public class ConversationMessage {

    public static final int MAX_CONTENT_LENGTH = 10000;

    @Id
    private String id;

    @JsonProperty("conversation_id")
    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @JsonProperty("sender_id")
    @Column(name = "sender_id", nullable = false)
    private String senderId;

    @JsonProperty("content")
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(nullable = false, length = MAX_CONTENT_LENGTH)
    private String content;

    @JsonProperty("file_name")
    @Column(name = "file_name")
    private String fileName;

    @JsonProperty("file_url")
    @Column(name = "file_url")
    private String fileUrl;

    @JsonProperty("mime_type")
    @Column(name = "mime_type")
    private String mimeType;

    @JsonProperty("created_at")
    @Column(name = "created_at", nullable = false)
    private String createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getSenderId() {
        return senderId;
    }

    public void setSenderId(String senderId) {
        this.senderId = senderId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
