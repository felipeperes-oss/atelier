# Atelier Backend

Backend em Spring Boot para o projeto Atelier.

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
http://localhost:8082/api
```

Se for abrir a API por outro dispositivo na rede, use o IP da máquina que está rodando o backend:

```text
http://IP_DA_SUA_MAQUINA:8082/api
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

## Quando o banco definitivo estiver pronto

Ative o perfil `prod` e informe as variaveis:

```powershell
$env:SPRING_PROFILES_ACTIVE="prod"
$env:DB_URL="jdbc:postgresql://localhost:5432/atelier"
$env:DB_USERNAME="usuario"
$env:DB_PASSWORD="senha"
mvn spring-boot:run
```

Se o banco nao for PostgreSQL, troque o driver no `pom.xml` e ajuste `spring.datasource.driver-class-name` em `src/main/resources/application-prod.properties`.

## Endpoints principais

- `GET /api/health`
- `GET /api/events?start=2026-06-01&end=2026-06-30`
- `POST /api/events`
- `GET /api/team-members`
- `POST /api/team-members`
- `GET /api/notes`
- `POST /api/notes`
- `GET /api/tutorials`
- `POST /api/tutorials`
- `GET /api/alerts`
- `POST /api/alerts`
