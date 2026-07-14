package br.com.atelier.app;

import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException ex) {
        HttpStatusCode statusCode = ex.getStatusCode();
        HttpStatus status = statusCode instanceof HttpStatus httpStatus ? httpStatus : HttpStatus.resolve(statusCode.value());
        String message = ex.getReason();
        if (message == null || message.isBlank()) {
            message = status != null ? status.getReasonPhrase() : statusCode.toString();
        }
        return ResponseEntity.status(statusCode).body(
                Map.of(
                        "status", status != null ? status.value() : statusCode.value(),
                        "error", status != null ? status.getReasonPhrase() : statusCode.toString(),
                        "message", message
                ));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceededException() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(
                Map.of(
                        "status", HttpStatus.PAYLOAD_TOO_LARGE.value(),
                        "error", HttpStatus.PAYLOAD_TOO_LARGE.getReasonPhrase(),
                        "message", "O arquivo e muito grande. Envie arquivos de ate 20 MB."
                ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolationException(DataIntegrityViolationException ex) {
        String details = ex.getMostSpecificCause() == null ? "" : ex.getMostSpecificCause().getMessage();
        String normalizedDetails = details.toLowerCase();
        String message = normalizedDetails.contains("chat_messages") && normalizedDetails.contains("content")
                ? "Mensagem muito longa. Envie ate " + ConversationMessage.MAX_CONTENT_LENGTH + " caracteres."
                : "Nao foi possivel salvar. Verifique os campos preenchidos e tente novamente.";

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                Map.of(
                        "status", HttpStatus.BAD_REQUEST.value(),
                        "error", HttpStatus.BAD_REQUEST.getReasonPhrase(),
                        "message", message
                ));
    }
}
