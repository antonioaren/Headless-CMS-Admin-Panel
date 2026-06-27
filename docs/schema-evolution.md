# Schema evolution (Feature D)

The graded core. For **any** schema mutation the system must: **(1) communicate the risk → (2) surface affected entries → (3) preview before applying → (4) let people fix data that no longer fits**, including mid-edit.

## The five mutation types

| Mutation               | Breaks                             | Handling                                                              |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **Rename field**       | nothing (id-keyed storage)         | pure label edit; **no migration**. The deliberate win.               |
| **Delete field**       | entries hold orphaned values       | destructive warning; drop the key (optionally archive into `config`) |
| **Retype field**       | existing values may not cast       | per-cell coercion (below). Hard case: `text → number`.               |
| **Make required**      | empty entries become invalid       | every empty cell → manual fix needed                                 |
| **Retarget reference** | existing IDs point at wrong schema | every existing ref → manual (re-pick); empty → ok                    |

## Per-cell coercion rules

Each affected cell ends as exactly one of `ok` · `auto` · `manual`.

| Change             | Rule                  | Result                                                        |
| ------------------ | --------------------- | ------------------------------------------------------------- |
| text → number      | `Number(v)` NaN?      | `"2024"` → **auto** (`2024`); `"vintage"`,`"n/a"` → **manual** |
| number → text      | always                | **auto**                                                      |
| any → boolean      | `"true"/"false"/1/0`? | matchable → auto, else manual                                 |
| any → date         | `Date.parse` valid?   | valid → auto, else manual                                     |
| make required      | value empty?          | empty → **manual**, else ok                                   |
| delete field       | —                     | drop/archive; destructive warning                             |
| retarget reference | —                     | non-empty → manual; empty → ok                                |

## The pipeline (one mechanism, all mutations)

```
diff(currentSchema, proposedSchema)
  → changes[]: { fieldId, kind: rename|delete|retype|require|retarget, from, to }
  → scan entries, classify each affected cell → ok | auto | manual
  → return MigrationPlan   ← this IS the preview (dry run, commits nothing)
  → on confirm: apply in a single transaction
       - bump schemas.version
       - write auto-coerced values
       - leave 'manual' cells flagged
  → surface 'manual' entries in a repair UI (edit / re-pick / default)
```

```ts
type MigrationPlan = {
  schemaId: string
  changes: { fieldId: string; kind: string; from: unknown; to: unknown }[]
  impact: {
    entryId: string
    fieldId: string
    status: 'ok' | 'auto' | 'manual'
    oldValue: unknown
    proposedValue?: unknown
    reason?: string
  }[]
  summary: { ok: number; auto: number; manual: number; destructive: boolean }
}
```

## Endpoints

| Endpoint                       | Behavior                                              |
| ------------------------------ | ---------------------------------------------------- |
| `POST /api/schemas/:id/plan`   | DRY RUN → MigrationPlan, no writes                   |
| `POST /api/schemas/:id/apply`  | execute in a transaction, bumps version              |

UI flow: call `plan` first → render summary + affected list → call `apply` only on explicit confirm.

## Mid-edit collision (D × C)

An open entry form stores `renderedSchemaVersion`. On a `schema.updated` event for that `schemaId` where `version > renderedSchemaVersion`:

- **Minimum (ship this):** non-destructive banner — "This schema changed; your form is out of date" — block save until reloaded.
- **Better (if time):** re-derive the form from the new schema, re-validate already-typed values, visually flag any field now invalid.

> **DECISION — OPEN:** banner (minimum) vs live re-validate (better). Pick one, implement cleanly, explain in the walkthrough. Record the choice in [decisions.md](./decisions.md).

## Walkthrough talking points

1. Id-keyed storage → rename is free; the read layer resolves ids → names.
2. JSONB + app-side integrity → the system can *hold* broken state to preview and repair it.
3. One MigrationPlan pipeline reused across all five mutation types (plan = dry run = preview).
4. `schema.version` as the mid-edit collision signal.
5. Which mid-edit behavior was chosen and why.
