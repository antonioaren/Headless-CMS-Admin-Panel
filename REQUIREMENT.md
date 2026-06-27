# REQUIREMENT — Headless CMS Admin Panel

Acceptance-criteria spec derived from [PRD.md](./PRD.md). Each requirement is testable. Priority: **MUST** (graded), **SHOULD** (if time), **COULD** (bonus). Feature D is the headline — everything else makes D demonstrable.

Legend: `GIVEN` precondition · `WHEN` action · `THEN` expected result.

---

## REQ-0 — Project setup & single-command run (PRD §1.2, M0)

- **MUST** The repo is a pnpm monorepo: `apps/backend`, `apps/frontend`, `packages/shared`.
- **MUST** `packages/shared` exports `Field`, `Schema`, `MigrationPlan` types, imported verbatim by both apps (zero drift).
- **MUST** Postgres runs via `docker-compose.yml` (postgres:16 image only); apps run natively via pnpm.
- **MUST** A single command brings up the whole system.
  - GIVEN a clean checkout
  - WHEN the reviewer runs `pnpm install && pnpm dev`
  - THEN Postgres is up, migrations run, seed runs, and both apps start — no manual back-and-forth.
- **MUST** README leads with `pnpm install && pnpm dev` and documents env + dev commands.

---

## REQ-A — Schema builder (PRD §4 A, M1)

- **MUST** Create / edit / delete content schemas. A schema = display name + ordered list of typed fields.
- **MUST** Field types supported: `text`, `number`, `boolean`, `date`, `reference`.
- **MUST** A `reference` field stores `reference_schema_id` (target schema).
- **MUST** Fields are reorderable, addable, removable within a schema.
- **MUST** Each field carries a STABLE `id` (never reused), `key` (renamable label), `type`, `required`, `position`.
- **MUST** Deleting a schema cascades its entries, and the UI warns before doing so.

**Acceptance**
- GIVEN no schemas exist
  WHEN I create `Person` (name: text required, birthYear: number)
  THEN `Person` is listed with its fields in order.
- GIVEN `Person` exists
  WHEN I create `Car` with field `owner` of type `reference` → `Person`
  THEN `Car.owner` persists `reference_schema_id` pointing at `Person`.
- GIVEN `Car` exists
  WHEN I reorder / add / remove a field
  THEN field `position` and the field set update accordingly.

---

## REQ-B — Dynamic entry editor (PRD §4 B, M2)

- **MUST** Create / view / edit / delete entries for any schema.
- **MUST** The entry form is **generated from the schema**, never hand-written per type, and re-derives when the schema changes.
- **MUST** Each field type renders its control:
  - text → text input · number → number input · boolean → checkbox · date → date picker
  - reference → searchable select of target-schema entries.
- **MUST** Entry `data` is keyed by `field.id`, not field name (PRD §3 decision 1).
- **MUST** The Zod validation schema is built at runtime from field definitions (`buildZodSchema(fields)`), shared between client and server.
- **MUST** Reference fields are navigable both directions.
  - GIVEN a `Car` entry whose `owner` references a `Person`
  - WHEN I click the owner reference
  - THEN I navigate to that `Person` entry, and can navigate back.

**Acceptance**
- GIVEN a `Car` entry form is open
  WHEN a new field is added to the `Car` schema
  THEN the new control appears in the entry form with no code changes.

---

## REQ-C — Real-time updates (PRD §4 C, M4)

- **MUST** Transport is socket.io. Server emits **only after** a successful DB write (DB is source of truth).
- **MUST** Socket payloads are thin (`id` + `schemaId` + `version`); clients refetch/patch the TanStack Query cache — payload is never trusted as source of truth.
- **MUST** Events: `schema.created/updated/deleted`, `entry.created/updated/deleted`.
- **MUST** Cross-client propagation works without refresh.
  - GIVEN two browser windows A and B on the same entry list
  - WHEN I create an entry in A
  - THEN it appears in B's list live.
- **MUST** A schema change reaching an open form is handled gracefully (see REQ-D mid-edit).
  - GIVEN B has a `Car` entry form open
  - WHEN A renames a field on `Car`
  - THEN B's form reacts (per the chosen mid-edit behavior).

---

## REQ-D — Schema evolution ⭐ (PRD §5, M5) — THE GRADED CORE

For **any** schema mutation the system MUST: **(1) communicate risk → (2) surface affected entries → (3) preview before applying → (4) let people fix data that no longer fits**, including mid-edit.

### REQ-D.1 — One MigrationPlan pipeline

- **MUST** All five mutation types run through ONE pipeline (not five bespoke flows):
  `diff(current, proposed) → changes[] → scan entries → classify each affected cell → MigrationPlan`.
- **MUST** `POST /api/schemas/:id/plan` is a dry run — returns a `MigrationPlan`, writes nothing.
- **MUST** `POST /api/schemas/:id/apply` executes in a single transaction: bumps `schemas.version`, writes auto-coerced values, leaves `manual` cells flagged.
- **MUST** The UI calls `plan` first, renders summary + affected list, and only calls `apply` on explicit confirm.
- **MUST** `MigrationPlan` matches the PRD §5.3 type (`changes[]`, `impact[]` with `ok|auto|manual`, `summary`).

### REQ-D.2 — Per-mutation behavior (PRD §5.1)

- **MUST (rename field)** Renaming is a pure label edit — **zero entry migration** (id-keyed storage). Showcase as a deliberate win.
  - GIVEN entries exist for a field
  - WHEN I rename that field
  - THEN no entry data changes and no migration is required; reads resolve the new name.
- **MUST (delete field)** Show a destructive warning; on apply, drop the key (optionally archive into `config`).
- **MUST (retype field)** Apply per-cell coercion (REQ-D.3).
- **MUST (make required)** Every empty cell becomes `manual` (needs fix).
- **MUST (retarget reference)** Every existing non-empty ref becomes `manual` (re-pick); empty → ok.

### REQ-D.3 — Per-cell coercion classification (PRD §5.2)

Each affected cell ends as exactly one of `ok` · `auto` · `manual`.

- **MUST** `text → number`: `Number(v)` not NaN → **auto**; else **manual**.
  - GIVEN `year` is text with values `"2024"`, `"vintage"`, `"n/a"`
  - WHEN I retype `year` → number
  - THEN `"2024"` auto-coerces to `2024`; `"vintage"` and `"n/a"` are flagged `manual`.
- **MUST** `number → text`: always **auto**.
- **MUST** `any → boolean`: matches `"true"/"false"/1/0` → **auto**; else **manual**.
- **MUST** `any → date`: `Date.parse` valid → **auto**; else **manual**.
- **MUST** `make required`: empty → **manual**; else **ok**.
- **MUST** `delete field`: drop/archive (destructive warning).
- **MUST** `retarget reference`: non-empty → **manual**; empty → **ok**.

### REQ-D.4 — Repair UI

- **MUST** After apply, `manual` entries are surfaced in a repair UI (edit / re-pick / default).
- **MUST** Repairs go through `PATCH /api/entries/:id` (same path as normal edits).
  - GIVEN a `manual`-flagged cell after a retype
  - WHEN I open the repair UI and enter a valid value
  - THEN the cell is no longer flagged and the entry validates.

### REQ-D.5 — Mid-edit collision (D × C, PRD §5.4, M6)

- **MUST** An open entry form records `renderedSchemaVersion`.
- **MUST** On a `schema.updated` event for that `schemaId` where `version > renderedSchemaVersion`, the form reacts. Pick ONE and implement cleanly:
  - **Minimum:** non-destructive banner ("This schema changed; your form is out of date") + block save until reloaded.
  - **Better (SHOULD):** re-derive form from new schema, re-validate typed values, visually flag fields now invalid.
- **MUST** The chosen behavior and its rationale are stated in the walkthrough.

---

## REQ-E — Read API (PRD §4 E, §6, M3)

- **MUST** `GET /api/content/:slug` returns all entries of a schema; `GET /api/content/:slug/:id` returns one.
- **MUST** Output resolves field `id` keys → current field **names** (because storage is id-keyed).
- **MUST** Reference values are resolved (proving id→name + reference resolver works before D builds on it).
  - GIVEN cars exist with an `owner` reference
  - WHEN I `GET /api/content/car`
  - THEN each car has human-readable field names and resolved values.
- **SHOULD** A single comment marks where an API key / auth middleware would slot in (read API is unauthenticated for the demo).

---

## REQ-DATA — Data model invariants (PRD §3)

- **MUST** Three fixed tables only: `schemas`, `fields`, `entries`. Only `entries.data` (JSONB) is dynamic. No dynamic DDL.
- **MUST** `entries.data` is keyed by `field.id`.
- **MUST** `schemas.version` is bumped on **every** schema change.
- **MUST** References are entry IDs stored in JSONB; integrity is enforced in app code, **not** a DB foreign key (so the system can hold temporarily-broken state for D).
- **MUST** Write path: `client → REST mutation → DB write (transaction) → on success socket emit → clients patch cache`.

---

## REQ-SEED — Seed data (PRD §7)

- **MUST** Seed `Car.year` as a **text** field holding `"2024"`, `"vintage"`, `"n/a"` (so the hard retype case is on screen instantly).
- **MUST** `Car` also has a boolean + date field (all five types exercised); `Person.name` required, `Person.birthYear` number.
- **MUST** Seed at least one `Car` referencing a `Person` (reference navigation + read resolver demonstrable).

---

## REQ-LINT — Tooling & code quality (not in PRD — added M0)

PRD §1 locks the runtime stack but never specs lint/format. This requirement closes that gap.

- **MUST** A single linter+formatter is configured at the monorepo root: **Biome** (`biome.json`).
- **MUST** Root scripts `lint` (`biome check .`) and `format` (`biome format --write .`) exist and pass clean.
- **MUST** Format rules match house style: lineWidth 120, single quotes, semicolons as-needed, no trailing commas.
- **MUST** TypeScript config is permissive per house rules (`strict: false`, `noImplicitAny: false`); `@/*` → `src/*` alias per app.
  - GIVEN a clean checkout
  - WHEN I run `pnpm lint`
  - THEN it exits 0 with no errors.

---

## REQ-DELIV — Deliverables (PRD §8) — all four required

- **MUST** Working app — runs, does what it sets out to.
- **MUST** README — install + run locally, no questions asked.
- **MUST** Walkthrough — async (<10 min video OR <15 slides), leads with the D pipeline; covers architecture, data model, realtime + schema evolution, trade-offs, next steps.
- **MUST** AI session log — chat export / prompts / screenshots.

---

## Non-goals (PRD §9 — out of scope, state deliberately)

Auth / multi-tenant / RBAC · pagination & search at scale · rich-text or media fields · nested/array/object fields · optimistic offline / CRDT merge · production deployment · validation rules beyond type + required.
