# Decision log

Architecture decisions (ADRs). Resolved decisions come from the PRD; open ones get recorded here as they're made.

Format: **Status** · **Context** · **Decision** · **Consequence**.

---

## ADR-001 — Entry data keyed by `field.id`, not field name

**Status:** Resolved (PRD)
**Context:** Renaming fields is common; field-name keys would force an entry migration on every rename.
**Decision:** Store `entries.data` keyed by stable `field.id`. Resolve ids → names at read time.
**Consequence:** Rename = one-row label edit, zero entry migration. Read layer needs an id→name resolver.

## ADR-002 — References as JSONB entry IDs, integrity in app code

**Status:** Resolved (PRD)
**Context:** Feature D must hold temporarily-broken reference state to preview and repair it.
**Decision:** Store reference values as entry UUIDs in JSONB; validate integrity in app code, no DB foreign key.
**Consequence:** System can hold broken state. Integrity checks live in app logic, not the DB.

## ADR-003 — JSONB entry storage, no dynamic DDL

**Status:** Resolved (PRD)
**Context:** Schema evolution needs a controllable, previewable transformation — not a live `ALTER TABLE`.
**Decision:** Entry content lives in a JSONB column; schema/field defs in relational tables.
**Consequence:** Migrations are app-code data transforms → "preview before applying" is possible.

## ADR-004 — One MigrationPlan pipeline for all five mutations

**Status:** Resolved (PRD)
**Context:** Five mutation types could each get bespoke handling — fragile, hard to demo.
**Decision:** All mutations flow through `diff → classify → MigrationPlan → apply`.
**Consequence:** plan = dry run = preview, reused everywhere. One mechanism to build and explain.

## ADR-006 — socket.io emit via module singleton, not Fastify plugin

**Status:** Resolved (M4)
**Context:** Routes need to emit socket events, but `io` is created in `index.ts` after routes are registered. Passing `io` as a Fastify plugin option is verbose; re-exporting from `index.ts` risks circular imports.
**Decision:** `apps/backend/src/lib/realtime.ts` holds a module-scoped `_io` reference, initialised once via `initRealtime(io)` called in `index.ts` after socket server creation. Routes import `emit()` from this module.
**Consequence:** Single initialisation point, no circular deps, easy to extend for M5's `apply` endpoint.

## ADR-007 — Manual repair state is ephemeral (router state, no DB column)

**Status:** Resolved (M5)
**Context:** After `apply`, entries with `manual` cells need to surface in a repair UI. Options: (a) persist a `__manual__` sentinel in `entries.data`, (b) add a `pending_repairs` DB table, (c) pass the `MigrationPlan` from the apply response via React Router `location.state`.
**Decision:** Option (c) — the apply response returns the full `MigrationPlan`; the frontend navigates to `/schemas/:id/repair` with `state: { plan }`. No DB column, no sentinel key.
**Consequence:** Repair state is session-scoped. If the user navigates away mid-repair, state is lost — but the underlying entry values are still wrong and classifiable again on the next plan run. Keeps the data model clean (no migration-bookkeeping pollution in `entries.data`).

---

## ADR-005 — Mid-edit collision behavior

**Status:** OPEN — decide by M6
**Context:** When a schema changes while a form is open (`version > renderedSchemaVersion`), the form is stale.
**Options:**
- **A (minimum):** non-destructive banner + block save until reloaded.
- **B (better):** re-derive form from new schema, re-validate typed values, flag now-invalid fields.
**Decision:** _TBD._
**Consequence:** _TBD — record rationale here once chosen; surface in walkthrough._
