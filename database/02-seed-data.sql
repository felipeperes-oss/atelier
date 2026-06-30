-- ============================================================
-- Script de dados iniciais - Projeto Atelier
-- SQL Server
-- Executar APÓS o script 01-create-database.sql
-- ============================================================

USE AtelierDB;
GO

-- ============================================================
-- 1. Inserir usuários iniciais
-- ============================================================
INSERT INTO app_user (id, email, password, display_name) VALUES
    ('user-alessandra', 'alessandra@atelier.local', '123456', 'Alessandra'),
    ('user-felipe',     'felipe@atelier.local',     '123456', 'Felipe'),
    ('user-lucas',      'lucas@atelier.local',       '123456', 'Lucas'),
    ('user-herysson',   'herysson@atelier.local',    '123456', 'Herysson');
GO

-- ============================================================
-- 2. Inserir perfis públicos
-- ============================================================
INSERT INTO profile (id, display_name) VALUES
    ('user-alessandra', 'Alessandra'),
    ('user-felipe',     'Felipe'),
    ('user-lucas',      'Lucas'),
    ('user-herysson',   'Herysson');
GO

-- ============================================================
-- 3. Inserir membros da equipe (tabela JPA)
-- ============================================================
INSERT INTO team_member (name, email, role) VALUES
    ('Alessandra', 'alessandra@atelier.local', 'Equipe'),
    ('Felipe',     'felipe@atelier.local',     'Equipe'),
    ('Lucas',      'lucas@atelier.local',       'Individual'),
    ('Herysson',   'herysson@atelier.local',    'Equipe');
GO

-- ============================================================
-- 4. Inserir eventos na agenda
-- ============================================================
INSERT INTO event (title, event_date, type, participants) VALUES
    ('Reuniao de Equipe', '2026-06-09', 'TEAM',       'Alessandra, Felipe +1'),
    ('HC UFMG',           '2026-06-15', 'INDIVIDUAL', 'Lucas'),
    ('Master Remoto',     '2026-06-19', 'TEAM',       'Felipe, Alessandra'),
    ('Apresentacao',      '2026-06-23', 'TEAM',       'Alessandra, Herysson');
GO

-- ============================================================
-- 5. Inserir tarefas
-- ============================================================
INSERT INTO task (id, title, task_date, scope, created_by) VALUES
    ('task-1', 'Reuniao de Equipe', '2026-06-09', 'group',      'user-felipe'),
    ('task-2', 'HC UFMG',           '2026-06-15', 'individual', 'user-lucas'),
    ('task-3', 'Master Remoto',     '2026-06-19', 'group',      'user-felipe'),
    ('task-4', 'Apresentacao',      '2026-06-23', 'group',      'user-alessandra');
GO

-- ============================================================
-- 6. Associar participantes às tarefas
-- ============================================================
INSERT INTO task_assignee (task_id, user_id) VALUES
    ('task-1', 'user-alessandra'),
    ('task-1', 'user-felipe'),
    ('task-2', 'user-lucas'),
    ('task-3', 'user-felipe'),
    ('task-3', 'user-alessandra'),
    ('task-4', 'user-alessandra'),
    ('task-4', 'user-herysson');
GO

-- ============================================================
-- 7. Inserir anotações
-- ============================================================
INSERT INTO note (id, title, content, scope, user_id) VALUES
    ('note-1', 'Anotacoes gerais',      'Espaco para registrar pontos gerais da equipe.', 'general',    'user-felipe'),
    ('note-2', 'Anotacoes individuais', 'Espaco para observacoes individuais.',             'individual', 'user-felipe');
GO

-- ============================================================
-- 8. Inserir alertas
-- ============================================================
INSERT INTO alert (id, title, message, priority, user_id) VALUES
    ('alert-1', 'Revisar agenda da semana', 'Conferir eventos e responsaveis antes da reuniao.', 'normal', 'user-felipe');
GO

-- ============================================================
-- 9. Inserir tutoriais
-- ============================================================
INSERT INTO tutorial (id, title, content, user_id) VALUES
    ('tutorial-1', 'Fluxo do calendario', 'Cadastrar eventos com data, tipo e participantes.', 'user-felipe');
GO

PRINT '=== Dados iniciais inseridos com sucesso! ===';
GO
