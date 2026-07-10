package br.com.atelier.app;

import java.util.ArrayList;
import java.util.List;

public class AppData {

    public List<AppUser> users = new ArrayList<>();
    public List<Profile> profiles = new ArrayList<>();
    public List<Task> tasks = new ArrayList<>();
    public List<TaskAssignee> task_assignees = new ArrayList<>();
    public List<AppNote> notes = new ArrayList<>();
    public List<AppAlert> alerts = new ArrayList<>();
    public List<AppTutorial> tutorials = new ArrayList<>();

    public static class AppUser {
        public String id;
        public String email;
        public String password;
        public String display_name;
    }

    public static class Profile {
        public String id;
        public String display_name;
    }

    public static class Task {
        public String id;
        public String title;
        public String description;
        public String task_date;
        public String scope;
        public boolean done;
        public String created_by;
        public String created_at;
    }

    public static class TaskAssignee {
        public String task_id;
        public String user_id;
    }

    public static class AppNote {
        public String id;
        public String title;
        public String content;
        public String scope;
        public String user_id;
        public String created_at;
        public String updated_at;
    }

    public static class AppAlert {
        public String id;
        public String title;
        public String message;
        public String priority;
        public String user_id;
        public String created_at;
    }

    public static class AppTutorial {
        public String id;
        public String title;
        public String content;
        public String url;
        public String user_id;
        public String created_at;
    }
}
