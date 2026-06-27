# PRD — Headless CMS Admin Panel

**Role:** Senior Frontend Engineer · The Agile Monkeys challenge
**Goal:** Build a working admin panel for a small headless CMS — define content schemas, manage entries through them, with live multi-client sync and a real schema-evolution story.

> **What they grade hardest:** Feature D (Schema evolution). Everything else exists to make D demonstrable. A small slice that _works_ beats a broad one that doesn't.

---

## 1. Stack (locked)

| Layer        | Choice                                                    | Why                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend     | **React 19 + Vite (SPA)**                                 | Pure client, hot realtime, no SSR plumbing to fight. The graded surface.                                                                                                                                                             |
| Routing      | **React Router**                                          | SPA navigation, incl. entry ↔ referenced-entry jumps.                                                                                                                                                                               |
| Server state | **TanStack Query**                                        | Cache + refetch; socket events patch/invalidate the cache.                                                                                                                                                                           |
| Forms        | **React Hook Form + Zod**                                 | Zod schema is **built at runtime** from field definitions (`buildZodSchema(fields)`).                                                                                                                                                |
| Backend      | **Fastify (thin)**                                        | Standalone long-lived server: hosts socket.io + REST + read API. (Express is equivalent if preferred.)                                                                                                                               |
| Realtime     | **socket.io**                                             | Server emits _after_ a successful DB write. DB is source of truth; socket payloads are thin (ids only).                                                                                                                              |
| DB           | **Postgres + JSONB**                                      | Schema/field defs in relational tables; entry data in a JSONB column. No dynamic DDL.                                                                                                                                                |
| DB access    | **Drizzle ORM**                                           | Type-safe queries + readable schema-as-code migrations; keeps the codebase easy to follow in the pairing review. Thin enough — and entry `data` stays hand-shaped JSONB (Drizzle types the 3 fixed tables, not the dynamic content). |
| Monorepo     | **pnpm workspaces**                                       | `apps/*` + `packages/shared` (types shared verbatim between client and server — `Field`, `Schema`, `MigrationPlan`). `pnpm -r --parallel run dev` runs everything with one command, no extra deps.                                   |
| Local run    | **Docker for Postgres only** (apps run natively via pnpm) | `docker-compose.yml` with the official `postgres` image. Apps stay outside Docker — no rebuild-on-change cost, full HMR. README must run end-to-end with zero back-and-forth.                                                        |

**Non-negotiable rationale to repeat in the walkthrough:** entry data lives in JSONB so that _schema evolution is a data transformation I fully control in app code_ — not a live `ALTER TABLE`. This is what makes "preview before applying" possible.

### 1.1 Repo structure

```
/
├── apps/
│   ├── backend/            Fastify + Drizzle + socket.io + read API
│   └── frontend/           Vite + React 19 SPA
├── packages/
│   └── shared/             Field/Schema/MigrationPlan types + the type-driven Zod-builder
│                           contract, imported by both apps — zero drift between
│                           what the server validates and what the client renders/validates.
├── docker-compose.yml      postgres:16 image only
├── pnpm-workspace.yaml
├── package.json            root scripts (below)
└── README.md
```

### 1.2 Single-command run

Root `package.json` scripts, composed so `pnpm dev` is the only command a reviewer needs:

```json
{
  "scripts": {
    "db:up": "docker compose up -d",
    "db:migrate": "pnpm --filter backend db:migrate",
    "db:seed": "pnpm --filter backend db:seed",
    "dev": "pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm -r --parallel run dev"
  }
}
```

`pnpm -r --parallel run dev` runs `apps/backend`'s and `apps/frontend`'s own `dev` scripts side by side — no `concurrently`, no extra dependency. README leads with: `pnpm install && pnpm dev`.

---

## 2. Architecture

```
┌────────────────────────┐         ┌──────────────────────────────┐
│  React 19 SPA (Vite)   │  REST   │   Fastify server (thin)      │
│  - schema builder      │◄───────►│   - /api/schemas  (CRUD)     │
│  - dynamic entry editor│         │   - /api/entries  (CRUD)     │
│  - migration preview UI│  WS     │   - /api/schemas/:id/plan    │
│  - TanStack Query cache│◄═══════►│   - /api/schemas/:id/apply   │
└────────────────────────┘ socket  │   - /api/content/* (read API)│
                                    │   - socket.io emit on write  │
                                    └───────────────┬──────────────┘
                                                    │ pg
                                            ┌───────▼────────┐
                                            │   Postgres     │
                                            │ schemas/fields │
                                            │ entries(JSONB) │
                                            └────────────────┘
```

Write path (the rule): **client → REST mutation → DB write (transaction) → on success, socket.io emit → all clients patch their TanStack Query cache.** Never trust the socket payload as the source of truth; it's a signal to refetch/patch.

---

## 3. Data model

Three fixed tables. Only the _content_ (entries.data) is dynamic.

```sql
create table schemas (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,        -- used in /api/content/:slug
  display_name  text not null,
  version       int  not null default 1,     -- bumped on EVERY schema change
  created_at    timestamptz default now()
);

create table fields (
  id                  uuid primary key default gen_random_uuid(),  -- STABLE, never reused
  schema_id           uuid not null references schemas(id) on delete cascade,
  key                 text not null,          -- renamable display label
  type                text not null,          -- text|number|boolean|date|reference
  required            boolean not null default false,
  reference_schema_id uuid references schemas(id),  -- only when type=reference
  position            int not null default 0,
  config              jsonb not null default '{}'   -- e.g. { "default": ... }
);

create table entries (
  id          uuid primary key default gen_random_uuid(),
  schema_id   uuid not null references schemas(id) on delete cascade,
  data        jsonb not null default '{}',   -- keyed by field.id, NOT field name
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

### The four decisions that matter (say these out loud)

1. **Entry data is keyed by `field.id`, never field name.** `data = { "f_abc": "Tesla", "f_owner": "<entry-uuid>" }`. Renaming a field becomes a one-row label edit with **zero entry migration**. The read API/forms resolve ids → current names on the way out (small serialization layer).
2. **References = entry IDs stored in JSONB, integrity enforced in app code** — _not_ a DB foreign key. D requires the system to _hold_ temporarily-broken state (a retargeted reference) so it can surface and repair it; a real FK would forbid that.
3. **Every schema change runs through one `MigrationPlan` pipeline** (§5). Five mutation types, one mechanism — not five bespoke flows.
4. **`schema.version` is the mid-edit collision detector** (§5.4). Open forms record the version they rendered against; a bump means "your form is stale."

---

## 4. Feature specs (A–E)

### A — Schema builder

Create / edit / delete content schemas. A schema = display name + ordered list of typed fields.
Field types: **text, number, boolean, date, reference** (reference stores `reference_schema_id`).
**Acceptance:** can create `Person`, then `Car` with `owner → Person`; reorder/add/remove fields; deleting a schema cascades its entries (warn first).

### B — Dynamic entry editor

Create / view / edit / delete entries for any schema. **The form is generated from the schema, never hand-written per type**, and re-derives when the schema changes.

- Each field type renders its control (text input, number, checkbox, date picker, reference = searchable select of target-schema entries).
- Reference fields are navigable: click owner → jump to that Person entry, and back.
  **Acceptance:** adding a field to `Car` makes the new control appear in the entry form without code changes.

### C — Real-time updates

What one client changes, others see without refresh: schema create/edit, entry add/edit/delete.

- Transport: socket.io. Events listed in §6.
- A schema change reaching an entry someone has open is handled gracefully (§5.4).
  **Acceptance:** two browser windows; create entry in A → appears in B's list live; rename a field in A → B's open form reacts.

### D — Schema evolution ⭐ (the main event — see §5)

### E — Read API

Bare read endpoints proving another app could consume the content (§6). Not production-grade. Keys resolved to current field **names** in the output (because storage is id-keyed).
**Acceptance:** `GET /api/content/car` returns all cars with human-readable field names and resolved values.

---

## 5. Schema evolution (Feature D) — full spec

For **any** schema mutation, the system must: **(1) communicate the risk → (2) surface affected entries → (3) preview before applying → (4) let people fix data that no longer fits**, including mid-edit.

### 5.1 The five mutation types and what each breaks

| Mutation               | Breaks                             | Handling                                                                  |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| **Rename field**       | nothing (id-keyed storage)         | pure label edit; **no migration**. Showcase this as a deliberate win.     |
| **Delete field**       | entries hold orphaned values       | **destructive warning**; drop the key (optionally archive into `config`). |
| **Retype field**       | existing values may not cast       | per-cell coercion (table below). Their named case: `text → number`.       |
| **Make required**      | empty entries become invalid       | every empty cell → **manual fix** needed.                                 |
| **Retarget reference** | existing IDs point at wrong schema | every existing ref → **manual** (re-pick); empty → ok.                    |

### 5.2 Per-cell coercion rules (classifies each affected value)

| Change             | Rule                  | Result                                                         |
| ------------------ | --------------------- | -------------------------------------------------------------- |
| text → number      | `Number(v)` NaN?      | `"2024"` → **auto** (`2024`); `"vintage"`,`"n/a"` → **manual** |
| number → text      | always                | **auto**                                                       |
| any → boolean      | `"true"/"false"/1/0`? | matchable → auto, else manual                                  |
| any → date         | `Date.parse` valid?   | valid → auto, else manual                                      |
| make required      | value empty?          | empty → **manual**, else ok                                    |
| delete field       | —                     | drop/archive; destructive warning                              |
| retarget reference | —                     | non-empty → manual; empty → ok                                 |

Each affected cell ends as one of: **`ok` · `auto` · `manual`**.

### 5.3 The MigrationPlan pipeline (one mechanism, all mutations)

```
diff(currentSchema, proposedSchema)
  → changes[]: { fieldId, kind: rename|delete|retype|require|retarget, from, to }
  → scan entries, classify each affected cell → ok | auto | manual
  → return MigrationPlan   ← this IS the preview (dry run, commits nothing)
  → on confirm: apply in a single transaction
       - bump schemas.version
       - write auto-coerced values
       - leave 'manual' cells flagged
  → surface 'manual' entries in a repair UI (edit/re-pick/default)
```

```ts
type MigrationPlan = {
  schemaId: string;
  changes: { fieldId: string; kind: string; from: unknown; to: unknown }[];
  impact: {
    entryId: string;
    fieldId: string;
    status: "ok" | "auto" | "manual";
    oldValue: unknown;
    proposedValue?: unknown;
    reason?: string;
  }[];
  summary: { ok: number; auto: number; manual: number; destructive: boolean };
};
```

Endpoints: `POST /api/schemas/:id/plan` (dry run → MigrationPlan, no writes) and `POST /api/schemas/:id/apply` (executes in a transaction). The UI calls `plan` first, renders the summary + affected list, and only calls `apply` on explicit confirm.

### 5.4 Mid-edit collision (D × C)

Open entry form stores `renderedSchemaVersion`. On a `schema.updated` event for that `schemaId` where `version > renderedSchemaVersion`:

- **Minimum (ship this):** non-destructive banner — "This schema changed; your form is out of date" — block save until reloaded.
- **Better (if time):** re-derive the form from the new schema, re-validate already-typed values, visually flag any field now invalid (e.g. a value that no longer fits a retyped field).

Pick one, implement it cleanly, and explain the choice in the walkthrough. They explicitly say you don't need every case.

---

## 6. API contract

**CRUD / management**

```
GET    /api/schemas                 list schemas (+ fields)
POST   /api/schemas                 create schema
PATCH  /api/schemas/:id             rename schema / reorder fields (non-evolving edits)
DELETE /api/schemas/:id             delete schema (cascade — warn in UI)

POST   /api/schemas/:id/plan        DRY RUN → MigrationPlan (no writes)
POST   /api/schemas/:id/apply       execute migration (transaction, bumps version)

GET    /api/entries?schema=:slug    list entries for a schema
POST   /api/entries                 create entry
GET    /api/entries/:id             one entry
PATCH  /api/entries/:id             update entry (also used for 'manual' repairs)
DELETE /api/entries/:id             delete entry
```

**Read API (Feature E)** — field ids resolved to current names in output

```
GET /api/content/:slug              all entries of a schema
GET /api/content/:slug/:id          one entry
```

**Socket.io events** (thin payloads — id + schemaId + version; clients refetch/patch)

```
schema.created   schema.updated   schema.deleted
entry.created    entry.updated    entry.deleted
```

> Security note (E): read API is unauthenticated for the demo (brief: "nothing production-grade"). Leave a single comment marking where an API key / auth middleware would slot in — enough to show you know, not enough to burn time.

---

## 7. Build order (milestones)

| #      | Milestone                                                                                                                                                                   | Output                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **M0** | Scaffold: pnpm monorepo (`apps/backend`, `apps/frontend`, `packages/shared`) + docker-compose Postgres + Drizzle migrations + **seed**, wired so `pnpm dev` runs everything | `pnpm install && pnpm dev` brings up DB + both apps end-to-end |
| **M1** | Schema builder (A)                                                                                                                                                          | create Person & Car w/ reference                               |
| **M2** | Dynamic entry editor (B)                                                                                                                                                    | schema-driven forms + reference navigation                     |
| **M3** | Read API (E) — _cheap; forces the id→name + reference resolver to work before D is built on top of it_                                                                      | `/api/content/*` returns resolved, readable data               |
| **M4** | Realtime (C)                                                                                                                                                                | socket layer + cache patching across 2 windows                 |
| **M5** | **Schema evolution (D)** — plan/preview/apply/repair                                                                                                                        | the headline; biggest block                                    |
| **M6** | Mid-edit collision (D×C) + polish                                                                                                                                           | banner/re-validate; empty/error states                         |
| **M7** | Deliverables                                                                                                                                                                | README, walkthrough, AI session log                            |

**Seed data tip:** seed `Car.year` as a **text** field holding `"2024"`, `"vintage"`, `"n/a"`. The instant a reviewer opens it and retypes `year → number`, the hard case they named is on screen — zero setup. Add a boolean + date field on `Car` so all five types are exercised; `Person.name` required, `Person.birthYear` number.

---

## 8. Deliverables (all four required)

- [ ] **Working app** — runs, does what it sets out to.
- [ ] **README** — install + run locally, no questions asked (docker-compose up, env, dev commands).
- [ ] **Walkthrough** — async: architecture, data model, how realtime + schema evolution work, trade-offs, what's next. **< 10 min video** or **< 15 slides**. Lead with the D pipeline.
- [ ] **AI session log** — chat export / prompts / screenshots. Own every line.

---

## 9. Non-goals (protect your time — out of scope)

Auth / multi-tenant / RBAC · pagination & search at scale · rich-text or media field types · nested/array/object fields · optimistic offline / conflict-free merge · production deployment · field validation rules beyond type + required.

State these as non-goals in the walkthrough so the scope reads as deliberate, not unfinished.

---

## 10. Things to call out explicitly in the walkthrough

1. **Id-keyed storage** → rename is free; the whole read layer resolves ids → names.
2. **JSONB + app-side integrity** → the system can _hold_ broken state so it can preview and repair it.
3. **One MigrationPlan pipeline** reused across all five mutation types (plan = dry run = preview).
4. **`schema.version`** as the mid-edit collision signal.
5. Which mid-edit behavior you chose (banner vs. live re-validate) **and why**.
6. Your non-goals — what you deliberately didn't build, and what you'd do next.
