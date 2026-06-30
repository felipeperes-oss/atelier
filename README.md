# Atelier Backend

Backend em Spring Boot para o projeto Atelier, migrado de persistência em arquivo JSON para **JPA/Banco de Dados Relacional**.

## Como rodar localmente

```powershell
mvn spring-boot:run
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Para acessar de outro dispositivo na mesma rede, abra o frontend usando o IP da sua máquina, por exemplo:

```text
http://IP_DA_SUA_MAQUINA:5173
```

O frontend já usa o hostname atual do navegador para montar a URL da API. Se quiser apontar para outro backend, defina `VITE_API_URL` no `frontend/.env`.

API local:

```text
http://localhost:8082/api/app
```

Console do banco H2 em memoria:

```text
http://localhost:8082/h2-console
```

Dados do H2:

```text
JDBC URL: jdbc:h2:mem:atelier
User: sa
Password:
```

## Banco de Dados Definitivo (SQL Server)

Os scripts de migração e criação estão na pasta [database/](file:///c:/Users/herysson.silva/Downloads/atelier-main/atelier-main/database):
- SQL Server: `01-create-database.sql` e `02-seed-data.sql`

Para rodar com o SQL Server, ative o perfil `prod` e informe as variaveis correspondentes:

```powershell
$env:SPRING_PROFILES_ACTIVE="prod"
$env:DB_URL="jdbc:sqlserver://localhost:1433;databaseName=AtelierDB;encrypt=true;trustServerCertificate=true"
$env:DB_USERNAME="usuario"
$env:DB_PASSWORD="senha"
mvn spring-boot:run
```

## Endpoints Principais

### Health Check
- `GET /api/health`

### Integração Frontend (`/api/app/*`)
- **Autenticação**:
  - `POST /api/app/auth/signup` - Cadastro de usuário e perfil
  - `POST /api/app/auth/signin` - Login de usuário
- **Perfis**:
  - `GET /api/app/profiles` - Lista de perfis públicos
  - `PUT /api/app/profiles/{id}` - Atualizar dados do perfil
- **Tarefas**:
  - `GET /api/app/tasks` - Listar tarefas por filtro de data/escopo/criador
  - `POST /api/app/tasks` - Criar tarefa
  - `PUT /api/app/tasks/{id}` - Atualizar status/dados de tarefa
  - `DELETE /api/app/tasks/{id}` - Excluir tarefa e seus participantes associados
- **Participantes de Tarefas (N:N)**:
  - `GET /api/app/task-assignees` - Listar associações de usuários a tarefas
  - `POST /api/app/task-assignees` - Associar usuários a tarefas
- **Notas**:
  - `GET /api/app/notes` - Listar notas com filtro por escopo/criador
  - `POST /api/app/notes` - Criar nota
  - `PUT /api/app/notes/{id}` - Editar nota
  - `DELETE /api/app/notes/{id}` - Excluir nota
- **Alertas**:
  - `GET /api/app/alerts` - Listar alertas ativos
  - `POST /api/app/alerts` - Criar alerta
  - `DELETE /api/app/alerts/{id}` - Excluir alerta
- **Tutoriais**:
  - `GET /api/app/tutorials` - Listar tutoriais cadastrados
  - `POST /api/app/tutorials` - Criar tutorial
  - `DELETE /api/app/tutorials/{id}` - Excluir tutorial

### Membros da Equipe (Soft Delete via `active` field)
- `GET /api/team-members` - Listar membros da equipe ativos
- `POST /api/team-members` - Cadastrar novo membro
- `PUT /api/team-members/{id}` - Atualizar dados do membro
- `DELETE /api/team-members/{id}` - Desativar membro (Soft Delete)
