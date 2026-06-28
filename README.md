# Headless CMS Admin Panel

Admin panel for a small headless CMS — define content schemas, manage entries through them, with live multi-client sync and a real **schema-evolution** story (preview impact before applying, repair data that no longer fits).

Built for [The Agile Monkeys](https://frontend-challenge-2026.theagilemonkeys.com/) frontend challenge. The graded core is **schema evolution** — see [Feature D](#feature-d--schema-evolution-).

> **Status:** core features implemented (schema builder, dynamic entries, read API, realtime, schema evolution). See [TASK.md](./TASK.md) for milestone-by-milestone detail.

---

## Quick start

> Requires: Node 22+, pnpm, Docker running (Postgres only).

```bash
pnpm install && pnpm dev
```

That one command brings up Postgres (Docker), runs migrations, seeds data, and starts both apps. No back-and-forth.

| App      | URL                     |
| -------- | ----------------------- |
| Frontend | http://localhost:5173   |
| Backend  | http://localhost:3000   |

### Environment

Optional — defaults are baked in, so `pnpm dev` works with no `.env`. To override, copy `apps/backend/env.example` → `apps/backend/.env`. Defaults match `docker-compose.yml`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cms
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

Frontend: `apps/frontend/env.example` → `.env` (optional; the Vite proxy handles `/api` + `/health` in dev).

### Commands

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | db up + migrate + seed + both apps (parallel)         |
| `pnpm db:up`      | Start Postgres via docker-compose                     |
| `pnpm db:migrate` | Run Drizzle migrations                                |
| `pnpm db:seed`    | Seed Person/Car schemas + demo entries                |

---

## Stack

| Layer        | Choice                       | Why                                               |
| ------------ | ---------------------------- | ------------------------------------------------- |
| Frontend     | React 19 + Vite (SPA)        | Pure client, hot realtime, no SSR plumbing        |
| Routing      | React Router                 | SPA nav incl. entry ↔ referenced-entry jumps      |
| Server state | TanStack Query               | Cache + refetch; socket events patch the cache    |
| Forms        | React Hook Form + Zod        | Zod schema built at runtime from field defs       |
| Backend      | Fastify (thin)               | Hosts socket.io + REST + read API                 |
| Realtime     | socket.io                    | Server emits after successful DB write            |
| DB           | Postgres + JSONB             | Field defs relational; entry data in JSONB        |
| DB access    | Drizzle ORM                  | Type-safe queries, schema-as-code migrations      |
| Monorepo     | pnpm workspaces              | `apps/*` + `packages/shared` (types shared)       |

**Why JSONB for entry data:** schema evolution is a data transformation handled in app code — not a live `ALTER TABLE`. That's what makes "preview before applying" possible.

---

## Architecture

```
┌────────────────────────┐         ┌──────────────────────────────┐
│  React 19 SPA (Vite)   │  REST   │   Fastify server (thin)      │
│  - schema builder      │◄───────►│   - /api/schemas  (CRUD)     │
│  - dynamic entry editor│         │   - /api/entries  (CRUD)     │
│  - migration preview UI│  WS     │   - /api/schemas/:id/plan    │
│  - TanStack Query cache│◄═══════►│   - /api/schemas/:id/apply   │
└────────────────────────┘ socket  │   - /api/content/* (read)    │
                                    │   - socket.io emit on write  │
                                    └───────────────┬──────────────┘
                                                    │ pg
                                            ┌───────▼────────┐
                                            │   Postgres     │
                                            │ schemas/fields │
                                            │ entries(JSONB) │
                                            └────────────────┘
```

**Write path (the rule):** client → REST mutation → DB write (transaction) → on success, socket.io emit → all clients patch their TanStack Query cache. The socket payload is a signal to refetch, never the source of truth.

### Repo structure

```
/
├── apps/
│   ├── backend/        Fastify + Drizzle + socket.io + read API
│   └── frontend/       Vite + React 19 SPA
├── packages/
│   └── shared/         Field/Schema/MigrationPlan types + Zod-builder contract
├── docs/               Project documentation (see below)
├── docker-compose.yml  postgres:16 image only
├── pnpm-workspace.yaml
└── package.json        root scripts
```

### Data model

Three fixed tables. Only `entries.data` (JSONB) is dynamic — no dynamic DDL.

- **`entries.data` is keyed by `field.id`, never field name.** Renaming a field = a one-row label edit with zero entry migration.
- **References = entry IDs in JSONB, integrity enforced in app code** — not a DB foreign key. The system must *hold* temporarily-broken state so it can surface and repair it.
- **`schema.version` bumps on every change** — also the mid-edit collision detector.

Full data-model rationale: [docs/data-model.md](./docs/data-model.md).

---

## Feature D — Schema evolution ⭐

The headline. For **any** schema mutation the system: (1) communicates the risk → (2) surfaces affected entries → (3) previews before applying → (4) lets people fix data that no longer fits, including mid-edit.

All five mutation types (rename / delete / retype / make-required / retarget) run through **one** `MigrationPlan` pipeline:

```
diff(current, proposed) → changes[] → scan entries → classify each cell (ok|auto|manual)
  → MigrationPlan (the preview — dry run, commits nothing)
  → on confirm: apply in one transaction (bump version, write auto values, flag manual cells)
  → repair UI for manual cells
```

`POST /api/schemas/:id/plan` is the dry run; `POST /api/schemas/:id/apply` commits. Full spec: [docs/schema-evolution.md](./docs/schema-evolution.md).

---

## Documentation

| Doc                                                   | Contents                                          |
| ----------------------------------------------------- | ------------------------------------------------- |
| [PRD.md](./PRD.md)                                    | Product requirements (source of truth)            |
| [REQUIREMENT.md](./REQUIREMENT.md)                    | Acceptance-criteria spec per feature              |
| [TASK.md](./TASK.md)                                  | Milestone build checklist (progress tracking)     |
| [docs/](./docs/)                                      | Architecture, data model, API, decisions          |

---

## Non-goals

Auth / multi-tenant / RBAC · pagination & search at scale · rich-text or media fields · nested/array/object fields · optimistic offline / CRDT merge · production deployment · validation beyond type + required. These are deliberate — not unfinished.

---

## Deliverables

- [ ] Working app
- [ ] README (this file)
- [ ] Walkthrough (<10 min video or <15 slides, leads with the D pipeline)
- [ ] AI session log
