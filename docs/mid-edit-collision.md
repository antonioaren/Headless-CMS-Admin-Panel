# Mid-Edit Collision (M6 — Feature D×C)

When a schema changes while an entry form is open the form is stale: its field list, Zod resolver, and rendered controls all reflect the old schema version. Saving on a stale form produces silently wrong data.

## Decision — ADR-005

**Option A (accepted):** non-destructive banner + block save until the user explicitly reloads.  
**Option B (deferred):** re-derive the form from the new schema, re-run validation, flag now-invalid fields.

Chose A because it satisfies REQ-D.5 MUST with minimal risk. The form stays intact; the user sees exactly what changed and decides when to continue. Option B is a future enhancement once the collision baseline is proven.

## How it works

```
schema changes in another tab/client
    ↓
backend PATCH /api/schemas/:id bumps schema.version
    ↓
server emits socket.io schema.updated { id, schemaId, version }
    ↓
useRealtimeSync invalidates ['schemas'] + ['schema', schemaId]
    ↓
EntryFormPage's useQuery(['schema', schemaId]) refetches
    ↓
new schema.version > renderedSchemaVersionRef.current
    ↓
setIsSchemaStale(true)
    ↓
EntryForm renders stale banner, submit disabled
    ↓
user clicks "Reload form"
    ↓
renderedSchemaVersionRef.current = schema.version, setIsSchemaStale(false)
    ↓
banner clears, save re-enabled
```

## Key implementation detail — `renderedSchemaVersionRef`

`renderedSchemaVersionRef` is a `useRef` (not state) because we need the version the form was **first rendered with**, not the current one. A ref survives re-renders without triggering them, so the comparison is always against the original baseline:

```ts
// Capture once on first load
useEffect(() => {
  if (schema && renderedSchemaVersionRef.current === null) {
    renderedSchemaVersionRef.current = schema.version
  }
}, [schema])

// Detect stale after every refetch
useEffect(() => {
  if (schema && renderedSchemaVersionRef.current !== null &&
      schema.version > renderedSchemaVersionRef.current) {
    setIsSchemaStale(true)
  }
}, [schema])
```

## Files

| File | Role |
|---|---|
| `apps/frontend/src/hooks/useRealtimeSync.ts` | Invalidates `['schema', payload.schemaId]` on `schema.updated` |
| `apps/frontend/src/pages/EntryFormPage/EntryFormPage.tsx` | Tracks `renderedSchemaVersionRef`, `isSchemaStale`, `handleReloadSchema` |
| `apps/frontend/src/components/EntryForm/EntryForm.tsx` | `isSchemaStale` + `onReloadSchema` props, stale banner, disabled submit |
| `apps/frontend/src/styles/global.css` | `.schema-stale-banner` styles |

## Why the per-schema query invalidation matters

`useRealtimeSync` previously only invalidated `['schemas']` (the list). `EntryFormPage` queries `['schema', schemaId]` (a single schema). Without the per-schema invalidation, the open form never received the updated version — the collision check would never fire. M6 adds `queryClient.invalidateQueries({ queryKey: ['schema', payload.schemaId] })` alongside the existing list invalidation.
