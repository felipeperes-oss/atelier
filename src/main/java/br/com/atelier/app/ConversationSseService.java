package br.com.atelier.app;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class ConversationSseService {

    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String conversationId) {
        return subscribeToKey("conversation:" + conversationId);
    }

    public SseEmitter subscribeToUser(String userId) {
        return subscribeToKey("user:" + userId);
    }

    private SseEmitter subscribeToKey(String key) {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitters.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeEmitter(key, emitter));
        emitter.onTimeout(() -> removeEmitter(key, emitter));
        emitter.onError((ex) -> removeEmitter(key, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data("connected"));
        } catch (IOException e) {
            // ignore
        }
        return emitter;
    }

    public void publishMessage(String conversationId, ConversationMessage message) {
        publishEvent("conversation:" + conversationId, "message", message);
    }

    public void publishTyping(String conversationId, Object payload) {
        publishEvent("conversation:" + conversationId, "typing", payload);
    }

    public void publishUserEvent(String userId, String eventName, Object payload) {
        publishEvent("user:" + userId, eventName, payload);
    }

    public void publishGlobalUserEvent(String eventName, Object payload) {
        emitters.keySet().stream()
                .filter(key -> key.startsWith("user:"))
                .forEach(key -> publishEvent(key, eventName, payload));
    }

    private void publishEvent(String key, String eventName, Object payload) {
        List<SseEmitter> list = emitters.get(key);
        if (list == null || list.isEmpty()) return;
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException e) {
                removeEmitter(key, emitter);
            }
        }
    }

    private void removeEmitter(String key, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(key);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                emitters.remove(key);
            }
        }
    }
}
