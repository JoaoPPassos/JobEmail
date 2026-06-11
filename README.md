# JobHub — Email Worker

Microserviço responsável por dois fluxos do ecossistema JobHub:

1. **Notificações de status** — consome a fila RabbitMQ `job.status.update` e envia e-mails transacionais para o candidato quando o status de uma vaga muda.
2. **Monitoramento de inbox** — conecta via IMAP ao e-mail de cada usuário, classifica mensagens recebidas de recrutadores com base em palavras-chave e atualiza o status da candidatura automaticamente.

---

## Arquitetura

```
RabbitMQ                          MongoDB
    │                                │
    ├── job.status.update ──► EmailModule ──► Nodemailer ──► Candidato
    │
    ├── job.created ──────────────────────────┐
    └── user.email.credentials.updated ───────┴──► InboxModule
                                                        │
                                            Cron (*/5 min) ──► IMAP
                                                        │       │
                                                        │   Classifier
                                                        │       │
                                                        └──► JobsHttpService ──► API Gateway
```

### Módulos

| Módulo | Responsabilidade |
|---|---|
| `EmailModule` | Consome `job.status.update` e envia e-mail via Nodemailer |
| `InboxModule` | Gerencia credenciais de inbox, executa scan por cron e classifica e-mails |

### Infraestrutura

| Serviço | Uso |
|---|---|
| **MongoDB** | Armazena credenciais de inbox (senha criptografada com AES-256-GCM) e histórico de e-mails processados |
| **RabbitMQ** | Fonte de eventos: `job.status.update`, `job.created`, `user.email.credentials.updated` |
| **IMAP** | Acesso ao inbox do usuário para leitura de e-mails recebidos |
| **SMTP** | Envio de e-mails de notificação via Nodemailer |
| **JobHub API Gateway** | Destino das atualizações de status (`PATCH /jobs/:id/metadata`) |

---

## Fluxos

### 1. Notificação de status

```
job.status.update (RabbitMQ)
  └── { jobId, status, email, userId }
        └── Nodemailer → e-mail para o candidato
        └── JobsHttpService → PATCH /jobs/:jobId/metadata { status }
```

### 2. Monitoramento de inbox (cron `*/5 * * * *`)

```
Para cada usuário com credenciais no MongoDB:
  1. Descriptografa a senha do inbox (AES-256-GCM)
  2. Conecta via IMAP e busca e-mails dos últimos N minutos
  3. Para cada e-mail não processado:
     a. Classifica por palavras-chave → ApplicationStatus
     b. Tenta associar ao job ativo (company + role no texto)
     c. Atualiza status no MongoDB e via API Gateway
     d. Marca e-mail como processado
```

### 3. Detecção de candidaturas sem resposta (cron diário `0 0 * * *`)

Candidaturas ativas sem atualização há mais de 14 dias são marcadas como `no_response` automaticamente.

---

## Status de candidatura

| Status | Descrição |
|---|---|
| `applied` | Candidatura enviada |
| `in_review` | Em análise pelo recrutador |
| `interview` | Entrevista agendada |
| `offer` | Oferta recebida |
| `rejected` | Candidatura rejeitada |
| `withdrawn` | Candidatura retirada pelo candidato |
| `no_response` | Sem resposta após 14 dias |

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não (padrão: 3000) | Porta HTTP da aplicação |
| `MONGODB_URI` | Sim | URI de conexão com o MongoDB |
| `RABBITMQ_URL` | Sim | URL do broker RabbitMQ |
| `SMTP_HOST` | Não (padrão: smtp.gmail.com) | Host SMTP |
| `SMTP_PORT` | Não (padrão: 587) | Porta SMTP |
| `SMTP_USER` | Sim | Usuário SMTP (remetente) |
| `SMTP_PASS` | Sim | Senha SMTP |
| `EMAIL_ENCRYPTION_KEY` | Sim | Chave AES-256 em hex (64 chars) para criptografar senhas de inbox |
| `JOBS_API_PORT` | Não (padrão: 3000) | Porta da API Gateway para atualização de status |
| `IMAP_PORT` | Não (padrão: 993) | Porta IMAP |
| `INBOX_SCAN_CRON` | Não (padrão: `*/5 * * * *`) | Expressão cron do scan de inbox |
| `INBOX_LOOKBACK_MINUTES` | Não (padrão: 15) | Janela de busca IMAP em minutos |
| `MONGO_USER` | Sim (Docker) | Usuário root do MongoDB local |
| `MONGO_PASSWORD` | Sim (Docker) | Senha root do MongoDB local |
| `MONGO_DB` | Não (padrão: jobhub) | Nome do banco MongoDB |
| `MONGO_PORT` | Não (padrão: 27017) | Porta exposta do MongoDB local |

---

## Rodando localmente

```bash
# Instalar dependências
pnpm install

# Rodar em modo watch
pnpm run start:dev
```

Crie um arquivo `.env` na raiz com as variáveis listadas acima.

### Com Docker

```bash
docker compose up -d
```

O `docker-compose.yml` sobe a aplicação e um MongoDB local. As variáveis `MONGO_USER`, `MONGO_PASSWORD` e `PORT` precisam estar no `.env`.

---

## Deploy

O deploy é feito automaticamente via GitHub Actions ao fazer push na branch `master`. O workflow:

1. Builda a imagem Docker e publica em `ghcr.io/joaoppassos/jobhub-email-ms:latest`
2. Aciona o deploy na VPS via Hostinger API

As variáveis e secrets necessários estão configurados no repositório GitHub (`Settings → Secrets and variables → Actions`).
