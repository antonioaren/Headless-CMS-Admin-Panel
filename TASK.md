# TASK — Build checklist

Milestone-ordered task breakdown from [PRD.md](./PRD.md) §7 build order, traced to [REQUIREMENT.md](./REQUIREMENT.md). Build order is deliberate: M3 (Read API) before M5 forces the id→name + reference resolver to exist before schema evolution builds on it.

Check items as completed. `→ REQ-x` links the requirement each task satisfies.

---

## M0 — Scaffold (→ REQ-0, REQ-DATA) ✅

- [x] Init pnpm workspace: `pnpm-workspace.yaml` with `apps/*` + `packages/*`
- [x] Root `package.json` scripts: `db:up`, `db:migrate`, `db:seed`, `dev` (`pnpm db:up && db:migrate && db:seed && pnpm -r --parallel run dev`)
- [x] `docker-compose.yml` — postgres:16 only
- [x] `packages/shared`: `Field`, `Schema`, `MigrationPlan` types + `buildZodSchema(fields)` contract
- [x] `apps/backend`: Fastify + Drizzle + socket.io scaffold, `dev` script
- [x] `apps/frontend`: Vite + React 19 + React Router + TanStack Query scaffold, `dev` script
- [x] Drizzle schema: `schemas`, `fields`, `entries` (entries.data = JSONB) + migration
- [x] Seed script (filled in M-SEED) wired into `db:seed`
- [x] Verify: clean checkout → `pnpm install && pnpm dev` brings up DB + both apps end-to-end
- [x] Biome lint+format wired (root `lint`/`format` scripts) — → REQ-LINT
- [~] README skeleton leading with `pnpm install && pnpm dev` (exists; sync env note: `env.example`, not `.env.example`)

## M1 — Schema builder / Feature A (→ REQ-A)

- [x] Backend `GET /api/schemas` — list schemas + fields
- [x] Backend `POST /api/schemas` — create (display_name + ordered typed fields)
- [x] Backend `PATCH /api/schemas/:id` — rename schema / reorder fields (non-evolving edits)
- [x] Backend `DELETE /api/schemas/:id` — cascade entries
- [x] Frontend schema list + create/edit form (name + fields)
- [x] Field editor: type picker (text/number/boolean/date/reference), required toggle, position
- [x] Reference field: pick `reference_schema_id` (target schema)
- [x] Add / remove / reorder fields in UI
- [x] Delete-schema confirmation warning (cascade)
- [x] Verify: create `Person`, then `Car` with `owner → Person`; reorder/add/remove fields

## M2 — Dynamic entry editor / Feature B (→ REQ-B)

- [x] Backend `GET /api/entries?schema=:slug` — list
- [x] Backend `POST /api/entries` — create
- [x] Backend `GET /api/entries/:id` — one
- [x] Backend `PATCH /api/entries/:id` — update (also used for manual repairs)
- [x] Backend `DELETE /api/entries/:id` — delete
- [x] Server-side validation via `buildZodSchema(fields)` (shared contract)
- [x] Frontend: schema-driven form generator (renders controls from field defs, keyed by field.id)
- [~] Controls: text input, number, checkbox, date picker, reference select of target entries (searchable select still pending)
- [x] RHF + Zod (`buildZodSchema`) client validation
- [~] Reference navigation: referenced-entry jump exists; return path still goes back to the entry list, not the source entry context
- [x] Frontend pages/components colocated into feature folders with `*.style.tsx` and smoke specs
- [x] Verify: add field to `Car` schema → new control appears in entry form, no code change

## M3 — Read API / Feature E (→ REQ-E) — cheap, builds the resolver ✅

- [x] id→name resolver (entry.data keyed by field.id → current field names)
- [x] Reference resolver (resolve referenced entry id → readable value)
- [x] Backend `GET /api/content/:slug` — all entries, resolved names + values
- [x] Backend `GET /api/content/:slug/:id` — one entry, resolved
- [x] Comment marking where API-key / auth middleware would slot in
- [x] Verify: `GET /api/content/car` returns cars with human-readable names + resolved owner

## M4 — Realtime / Feature C (→ REQ-C) ✅

- [x] socket.io server: emit AFTER successful DB write only (thin payload: id + schemaId + version)
- [x] Wire emit into every mutation (schema create/update/delete, entry create/update/delete)
- [x] Frontend socket client: subscribe to events
- [x] On event → patch/invalidate TanStack Query cache (never trust payload as source of truth)
- [ ] Verify: 2 windows — create entry in A → appears live in B's list
- [ ] Verify: rename field in A → B's open form reacts (hands to M6)

## M5 — Schema evolution / Feature D ⭐ (→ REQ-D) — the headline

- [x] `diff(currentSchema, proposedSchema)` → `changes[]` (rename|delete|retype|require|retarget, from/to)
- [x] Entry scan: classify each affected cell → `ok | auto | manual`
- [x] Per-cell coercion rules (REQ-D.3): text→number, number→text, any→boolean, any→date, make-required, delete, retarget
- [x] Build `MigrationPlan` (changes + impact[] + summary{ok,auto,manual,destructive}) — PRD §5.3 type
- [x] Backend `POST /api/schemas/:id/plan` — dry run, returns MigrationPlan, NO writes
- [x] Backend `POST /api/schemas/:id/apply` — single transaction: bump version, write auto values, flag manual cells
- [x] Rename = pure label edit, zero entry migration (verify no data touched)
- [x] Delete field: destructive warning + drop/archive key into config
- [x] Frontend migration preview UI: render summary + affected-entry list from plan
- [x] Confirm gate: `apply` only fires on explicit confirm
- [x] Repair UI: surface `manual` entries, edit/re-pick/default → `PATCH /api/entries/:id`
- [ ] Verify: retype `year` text→number → `"2024"` auto=2024, `"vintage"`/`"n/a"` flagged manual, repairable

## M6 — Mid-edit collision (D×C) + polish (→ REQ-D.5, REQ-C)

- [x] Open form records `renderedSchemaVersion`
- [x] On `schema.updated` where `version > renderedSchemaVersion` → react
- [x] Implement chosen behavior: banner + block save (minimum) OR re-derive + re-validate (better)
- [x] Empty states + error states across schema list, entry list, forms
- [x] Loading / pending states on mutations
- [x] Decide + note chosen mid-edit behavior for walkthrough

## M7 — Deliverables (→ REQ-DELIV)

- [ ] README: install + run, env, dev commands — no questions asked
- [ ] Walkthrough (<10 min video OR <15 slides), leads with D pipeline; architecture, data model, realtime, evolution, trade-offs, next
- [x] AI session log: chat export / prompts / screenshots
- [ ] Final pass: confirm all four deliverables present

## M-SEED — Seed data (→ REQ-SEED) — fill during M0, verify usable by M5

- [ ] `Person`: `name` (text, required), `birthYear` (number)
- [ ] `Car`: `year` (text) = `"2024"`, `"vintage"`, `"n/a"` across entries
- [ ] `Car`: + boolean field + date field (exercise all five types)
- [ ] `Car`: + `owner` reference → `Person`
- [ ] Seed ≥1 Car referencing a Person (reference nav + read resolver demonstrable)
