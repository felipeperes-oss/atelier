-- ============================================================
-- Script de criação do Banco de Dados - Projeto Atelier
-- SQL Server
-- ============================================================

-- 1. Criar o banco de dados
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'AtelierDB')
BEGIN
    CREATE DATABASE AtelierDB;
END
GO

USE AtelierDB;
GO

-- ============================================================
-- 2. Tabela: app_user (Usuários do sistema)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'app_user')
BEGIN
    CREATE TABLE app_user (
        id           NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
        email        NVARCHAR(255)  NOT NULL UNIQUE,
        password     NVARCHAR(255)  NOT NULL,
        display_name NVARCHAR(255)  NOT NULL,
        active       BIT            NOT NULL DEFAULT 1,
        created_at   DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at   DATETIME2      NOT NULL DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- 3. Tabela: profile (Perfis públicos dos usuários)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'profile')
BEGIN
    CREATE TABLE profile (
        id           NVARCHAR(36)   NOT NULL PRIMARY KEY,
        display_name NVARCHAR(255)  NOT NULL,
        CONSTRAINT FK_profile_user FOREIGN KEY (id) REFERENCES app_user(id)
            ON DELETE CASCADE
    );
END
GO

-- ============================================================
-- 4. Tabela: team_member (Membros da equipe)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'team_member')
BEGIN
    CREATE TABLE team_member (
        id     BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name   NVARCHAR(255)        NOT NULL,
        email  NVARCHAR(255)        NULL,
        role   NVARCHAR(100)        NULL,
        active BIT                  NOT NULL DEFAULT 1
    );
END
GO

-- ============================================================
-- 5. Tabela: event (Eventos / Agenda)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'event')
BEGIN
    CREATE TABLE event (
        id           BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        title        NVARCHAR(255)        NOT NULL,
        description  NVARCHAR(1000)       NULL,
        event_date   DATE                 NOT NULL,
        type         NVARCHAR(50)         NOT NULL DEFAULT 'GENERAL',
        participants NVARCHAR(500)        NULL,
        CONSTRAINT CK_event_type CHECK (type IN ('TEAM', 'INDIVIDUAL', 'GENERAL'))
    );
END
GO

-- ============================================================
-- 6. Tabela: task (Tarefas)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task')
BEGIN
    CREATE TABLE task (
        id          NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
        title       NVARCHAR(255)  NOT NULL,
        description NVARCHAR(2000) NULL,
        task_date   DATE           NOT NULL,
        scope       NVARCHAR(50)   NOT NULL DEFAULT 'group',
        done        BIT            NOT NULL DEFAULT 0,
        created_by  NVARCHAR(36)   NULL,
        created_at  DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_task_user FOREIGN KEY (created_by) REFERENCES app_user(id)
            ON DELETE SET NULL,
        CONSTRAINT CK_task_scope CHECK (scope IN ('group', 'individual'))
    );
END
GO

-- ============================================================
-- 7. Tabela: task_assignee (Associação Tarefa <-> Usuário)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'task_assignee')
BEGIN
    CREATE TABLE task_assignee (
        task_id NVARCHAR(36) NOT NULL,
        user_id NVARCHAR(36) NOT NULL,
        CONSTRAINT PK_task_assignee PRIMARY KEY (task_id, user_id),
        CONSTRAINT FK_ta_task FOREIGN KEY (task_id) REFERENCES task(id)
            ON DELETE CASCADE,
        CONSTRAINT FK_ta_user FOREIGN KEY (user_id) REFERENCES app_user(id)
            ON DELETE CASCADE
    );
END
GO

-- ============================================================
-- 8. Tabela: note (Anotações)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'note')
BEGIN
    CREATE TABLE note (
        id         NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
        title      NVARCHAR(255)  NOT NULL,
        content    NVARCHAR(4000) NULL,
        scope      NVARCHAR(50)   NOT NULL DEFAULT 'general',
        user_id    NVARCHAR(36)   NULL,
        created_at DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_note_user FOREIGN KEY (user_id) REFERENCES app_user(id)
            ON DELETE SET NULL,
        CONSTRAINT CK_note_scope CHECK (scope IN ('general', 'individual'))
    );
END
GO

-- ============================================================
-- 9. Tabela: alert (Alertas / Lembretes)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'alert')
BEGIN
    CREATE TABLE alert (
        id         NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
        title      NVARCHAR(255)  NOT NULL,
        message    NVARCHAR(1000) NULL,
        priority   NVARCHAR(50)   NOT NULL DEFAULT 'normal',
        user_id    NVARCHAR(36)   NULL,
        due_date   DATE           NULL,
        is_read    BIT            NOT NULL DEFAULT 0,
        created_at DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_alert_user FOREIGN KEY (user_id) REFERENCES app_user(id)
            ON DELETE SET NULL,
        CONSTRAINT CK_alert_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
    );
END
GO

-- ============================================================
-- 10. Tabela: tutorial (Tutoriais)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tutorial')
BEGIN
    CREATE TABLE tutorial (
        id         NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
        title      NVARCHAR(255)  NOT NULL,
        content    NVARCHAR(4000) NULL,
        url        NVARCHAR(500)  NULL,
        user_id    NVARCHAR(36)   NULL,
        published  BIT            NOT NULL DEFAULT 1,
        created_at DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_tutorial_user FOREIGN KEY (user_id) REFERENCES app_user(id)
            ON DELETE SET NULL
    );
END
GO

-- ============================================================
-- 11. Índices para performance
-- ============================================================

-- Busca de eventos por data (usado no endpoint GET /api/events?start=&end=)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_event_date')
    CREATE INDEX IX_event_date ON event (event_date, title);
GO

-- Busca de tarefas por data e escopo
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_task_date_scope')
    CREATE INDEX IX_task_date_scope ON task (task_date, scope);
GO

-- Busca de notas por usuário
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_note_user')
    CREATE INDEX IX_note_user ON note (user_id, scope);
GO

-- Busca de alertas ordenados por data
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_alert_created')
    CREATE INDEX IX_alert_created ON alert (created_at DESC);
GO

-- Busca de tutoriais ordenados por data
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tutorial_created')
    CREATE INDEX IX_tutorial_created ON tutorial (created_at DESC);
GO

PRINT '=== Banco de dados AtelierDB criado com sucesso! ===';
GO
