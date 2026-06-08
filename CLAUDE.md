These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work.

Always we will have a grill-me, to understand the feature.

## Rule 1 — Think Before Coding
State assumptions explicitly. Ask rather than guess.
Push back when a simpler approach exists. Stop when confused.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No abstractions for single-use code.

## Rule 3 — Surgical Changes
Touch only what you must. Don't improve adjacent code.
Match existing style. Don't refactor what isn't broken.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Strong success criteria let Claude loop independently.

## Rule 5 — Use the model only for judgment calls
Use for: classification, drafting, summarization, extraction.
Do NOT use for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
If unsure why existing code is structured a certain way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

---


## Architecture

This project follows **Clean Architecture** with NestJS. Three main layers:

```
src/
├── domain/          # Business rules — no framework dependencies
├── infrastructure/  # Framework & external integrations (TypeORM, RabbitMQ, email)
├── modules/         # Feature modules (HTTP layer: controllers, services, DTOs)
└── shared/          # Cross-cutting: base entity, enums, guards, response wrappers
```

### Layer rules

**domain/**
- `entities/` — TypeORM entities that extend `BaseEntity` (id, created_at, updated_at, deleted_at).
- `ports/` — Interface contracts (prefixed with `I`). Define what infrastructure must implement. Never import from `modules/` or `infrastructure/`.
- `use-cases/` — Pure orchestration logic. No NestJS decorators. Receive all deps via constructor. One use-case per action (e.g. `CreateApplicationUseCase`).

**infrastructure/**
- `repositories/` — Implement domain ports. Use TypeORM's `@InjectRepository`. Handle all DB queries. Throw custom exceptions from `shared/exceptions/`.
- `messaging/` — RabbitMQ publishers using `@golevelup/nestjs-rabbitmq`. Exchange `"jobs"`, routing key `"job.enrich"` for job enrichment flow.
- `services/` — External service adapters (LinkedIn processor, hashing, email). Implement domain port interfaces.
- `migrations/` — All schema changes go through TypeORM migrations. Never alter the DB schema by hand.

**modules/**
- Each feature module must have: `controllers/`, `services/`, `dto/`, `interfaces/`, `tests/`.
- Controllers handle HTTP only — no business logic. Return `SuccessResponse<T>`.
- Services instantiate use-cases with their dependencies inline (not provided by the container).
- DTOs use `class-validator` decorators. Swagger `@ApiProperty` on every field.

**shared/**
- `BaseEntity` — always extend this for new entities.
- `SuccessResponse<T>` / `FailResponse` — always wrap controller return values.
- `shared/enums/` — enums used by more than one module go here.
- `shared/exceptions/` — use existing custom exceptions; don't throw raw NestJS `HttpException` in repositories.

### Naming conventions

| Artifact | Convention | Example |
|---|---|---|
| Files | kebab-case | `create-user.use-case.ts` |
| Classes | PascalCase | `CreateUserUseCase` |
| Interfaces | `I` prefix | `IAuth`, `IJob` |
| Enums | snake_case values | `application_status` |
| Entity columns | snake_case | `salary_range`, `source_url` |
| DTOs | `{Action}{Entity}DTO` | `UpdateJobMetadataDTO` |
| Tests | same name + `.spec.ts` | `jobs.service.spec.ts` |

### Key patterns

- **Repository types**: Use `Partial<Omit<Entity, baseOmit>>` for update/save payloads. `baseOmit = 'id' | 'created_at' | 'updated_at' | 'deleted_at'`.
- **Use-case wiring**: Services `new UseCase(repo, dep)` inside method scope — do not inject use-cases via the NestJS container.
- **Job enrichment flow**: `POST /job-applications` → publisher sends `{ jobId, sourceUrl, sourcePlatform }` to RabbitMQ → external worker scrapes metadata → `PATCH /jobs/:id/metadata` sets `metadata_status: 'completed'`.
- **Auth**: `JwtAuthGuard` on all protected routes. JWT secret from `config/configuration.ts`.
- **Soft delete**: `deleted_at` column on all entities; never hard-delete rows.