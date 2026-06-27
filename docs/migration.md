# Schema migration (Feature D) — implementation

The graded core. One pipeline handles all five schema mutation types. This doc covers the implementation — for the product design rationale see [schema-evolution.md](./schema-evolution.md).

---

## Pipeline overview

```
SchemaFormPage (edit)
  │
  ├─ POST /api/schemas/:id/plan  ← dry run, NO writes
  │     returns MigrationPlan
  │
  ├─ MigrationPreviewModal
  │     shows summary + impact table
  │     user confirms or cancels
  │
  ├─ POST /api/schemas/:id/apply ← single transaction
  │     writes auto values, drops deleted keys,
  │     updates fields, bumps schemas.version,
  │     emits schema.updated
  │
  └─ RepairPage (if summary.manual > 0)
        one EntryForm per manual entry
        saves via PATCH /api/entries/:id
```

---

## Shared pure functions — `packages/shared/src/migration.ts`

Three exports. Zero DB access. Used verbatim by both the client (plan preview) and the server (plan + apply), so classification always agrees.

### `diff(current, proposed): MigrationChange[]`

Compares current schema fields against proposed fields by `field.id`. Emits one `MigrationChange` per mutation detected:

| Mutation | `kind` | `from` | `to` |
|---|---|---|---|
| Field removed from proposed | `delete` | field key | `null` |
| `key` changed | `rename` | old key | new key |
| `type` changed | `retype` | old type | new type |
| `required` false → true | `require` | `false` | `true` |
| `referenceSchemaId` changed | `retarget` | old schema id | new schema id |

New fields (no `id` in proposed) produce no change entry — they have no existing entry data to migrate.

### `classifyCell(change, value): { status, proposedValue?, reason? }`

Maps a single `(change, entry cell value)` pair to one of three statuses:

| Change kind | Rule | Result |
|---|---|---|
| `rename` | always | `ok` — id-keyed storage, no data touched |
| `delete` | always | `auto` — key will be dropped |
| `require` | value empty? | empty → `manual`; else `ok` |
| `retarget` | value non-empty? | non-empty → `manual`; empty → `ok` |
| `retype` text → number | `Number(v)` not NaN | parseable → `auto` (proposedValue = number); else `manual` |
| `retype` number → text | always | `auto` (proposedValue = String) |
| `retype` any → boolean | "true"/"false"/1/0 | matchable → `auto`; else `manual` |
| `retype` any → date | `Date.parse` valid | parseable → `auto` (ISO string); else `manual` |

### `buildPlan(schemaId, changes, entries): MigrationPlan`

Runs `classifyCell` for every `(entry × change)` pair and assembles:

```ts
{
  schemaId,
  changes,           // MigrationChange[]
  impact,            // MigrationImpact[] — one row per affected cell
  summary: {
    ok, auto, manual,
    destructive      // true if any change has kind === 'delete'
  }
}
```

---

## Backend endpoints — `apps/backend/src/routes/migrations.ts`

### `POST /api/schemas/:id/plan`

Dry run. **Writes nothing.**

1. Fetch current schema + fields
2. Validate body (same shape as `PATCH /api/schemas/:id`)
3. `diff(current, proposed)` → `changes`
4. Fetch all entries for this schema
5. `buildPlan(schemaId, changes, entries)` → `MigrationPlan`
6. Return `{ data: MigrationPlan }`

### `POST /api/schemas/:id/apply`

Re-derives the plan server-side (never trusts client payload), then commits in a **single transaction**:

1. Apply auto coercions — for each entry that has `auto` impacts: load, merge coerced values, write back (one update per entry, not one per cell)
2. Drop deleted field keys from all entry data
3. Delete removed field rows
4. Update/insert field rows (key, type, required, referenceSchemaId, position)
5. Bump `schemas.version += 1`; optionally update `displayName`
6. After commit: `emit('schema.updated', { id, schemaId, version })`

Returns `{ data: { schema, plan } }` — the `plan` drives the repair UI (manual impact list).

---

## Frontend

### `SchemaFormPage` (edit mode)

Submit no longer calls `PATCH` directly. Instead:

1. `POST /api/schemas/:id/plan` with form values
2. On success → open `MigrationPreviewModal` with the returned plan
3. Modal confirm → `POST /api/schemas/:id/apply`
4. On apply success:
   - `summary.manual > 0` → `navigate('/schemas/:id/repair', { state: { plan } })`
   - else → `navigate('/schemas')`

### `MigrationPreviewModal`

Receives `MigrationPlan` and the proposed fields list. Renders:
- Summary bar: `ok N · auto N · manual N`
- Destructive warning banner (if `summary.destructive`)
- Manual warning banner with count (if `summary.manual > 0`)
- Impact table sorted by status (manual first): field name, current value, proposed value, status badge
- Cancel / Apply buttons

### `RepairPage` — `/schemas/:id/repair`

Receives `MigrationPlan` via React Router `location.state`. Manual repair state is **ephemeral** — no DB column needed (see ADR-007).

- Reads manual entry ids from `plan.impact.filter(i => i.status === 'manual')`
- Renders one `<EntryForm>` per manual entry (queries the entry fresh from DB)
- Each save calls `PATCH /api/entries/:id` via the existing `updateEntry` helper
- As entries are repaired they're removed from the list (local state)
- "Skip remaining repairs" exits to `/schemas`

### `EntryForm` component — `apps/frontend/src/components/EntryForm/EntryForm.tsx`

Extracted from `EntryFormPage` to be reusable. Accepts:

```ts
{
  schema: Schema
  entry?: Entry       // undefined = create mode
  onSave: (data: EntryData) => Promise<void>
  onCancel: () => void
  isPending?: boolean
  error?: string
  submitLabel?: string
}
```

Owns the RHF setup, `buildZodSchema` resolver, edit-mode population, and all field control rendering. `EntryFormPage` is now a thin wrapper that handles routing params, queries, and mutations before delegating to `EntryForm`.

---

## Key invariants

- `plan` **writes nothing** — enforced at the route level, no transaction opened.
- `apply` **re-derives the plan** server-side — the client's local plan is display-only.
- `rename` → **zero entry migration** — field key update only, no `entries.data` touched.
- **One pipeline** for all five mutation types (ADR-004) — no per-mutation branches.
- `classifyCell` in `packages/shared` → client preview and server apply agree exactly.
