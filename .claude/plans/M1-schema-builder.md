# M1 — Schema builder (Feature A)

**Goal:** Create / edit / delete content schemas — display name + ordered typed fields. (→ REQ-A)

## Acceptance (REQ-A)
- Create `Person` (name: text required, birthYear: number) → listed with fields in order.
- Create `Car` with `owner` reference → `Person`; `reference_schema_id` persists.
- Reorder / add / remove fields → `position` + field set update.
- Delete schema cascades entries, UI warns first.

## Approach
- **Backend** (`apps/backend/src/`): routes module for schemas. `GET /api/schemas` returns schemas + their fields ordered by `position`. `POST` creates schema + fields in one transaction. `PATCH /api/schemas/:id` handles non-evolving edits only (rename schema, reorder fields) — field-set/type changes that affect entries go through M5's plan/apply, not here. `DELETE` cascades (FK `on delete cascade` already set in `db/schema.ts`).
- **Frontend** (`apps/frontend/src/`): schema list route + create/edit form. Field editor row: key, type picker (text/number/boolean/date/reference), required toggle, position; reference type reveals a target-schema select. Delete confirmation dialog.
- Validate request bodies with Zod on the backend. Field `id`s are server-generated (stable uuid) — never client-assigned.

## Files (new)
`apps/backend/src/routes/schemas.ts` · register in `src/index.ts` · `apps/frontend/src/routes/` schema list + editor · shared types already in `@cms/shared`.

## Verify
Create Person then Car w/ owner→Person; reorder/add/remove fields; delete a throwaway schema and confirm its entries are gone.

## Watch
- Do NOT let PATCH mutate fields in ways that strand entry data — that is M5's job (plan/apply). M1 PATCH = rename schema + reorder only.
- Field `id` stability is sacred (ADR-001). See [architecture-invariants](../rules/architecture-invariants.md).
