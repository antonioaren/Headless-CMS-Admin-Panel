# Read API (M3 / Feature E)

Bare read endpoints that prove another app can consume the CMS content. Field ids are resolved to current field names on the way out, and reference values are expanded to a readable object.

## Endpoints

```
GET /api/content/:slug        all entries of a schema, resolved
GET /api/content/:slug/:id    one entry, resolved
```

Both return HTTP 404 when the slug or entry id does not exist.

## Response shape

```json
{
  "data": [
    {
      "id": "04cbddcf-...",
      "schemaId": "31b8dc6a-...",
      "data": {
        "year": "2024",
        "electric": true,
        "purchasedAt": "2024-03-15",
        "owner": {
          "id": "eed29421-...",
          "label": "Ada Lovelace"
        }
      },
      "createdAt": "2026-06-27T15:07:39.951Z",
      "updatedAt": "2026-06-27T15:07:39.951Z"
    }
  ]
}
```

`GET /api/content/:slug/:id` wraps a single entry under `{ "data": { ... } }` instead of an array.

## Resolver

`apps/backend/src/lib/resolve.ts` is the shared serialization layer. It takes a schema's fields and a list of raw entry rows and produces human-readable output.

**id → name mapping**

`entries.data` is keyed by `field.id` (e.g. `"f_abc": "Tesla"`). The resolver iterates the schema's `fields` rows and maps each id to the current `fields.key` value. This is why renaming a field requires zero entry migration — the resolver always reads the live name from the `fields` table.

**Reference expansion**

For `type === 'reference'` fields, the raw value is an entry UUID. The resolver batch-loads all referenced entries in a single query, finds the first `text` field of the referenced schema, and emits:

```json
{ "id": "<referenced-entry-uuid>", "label": "<first text field value>" }
```

If the referenced entry has no text field, `label` falls back to the entry id. If the referenced entry no longer exists (broken reference), the raw UUID is returned as-is — the system is allowed to hold that state (see [data-model.md](./data-model.md) §references).

**Exports**

```ts
resolveEntries(schemaFields, schemaEntries) → Promise<ResolvedEntry[]>
resolveEntry(schemaFields, entry)           → Promise<ResolvedEntry>
```

Both are exported so M5 plan/preview/apply and the entry detail view can reuse them without duplicating the id→name logic.

## Security

The read API is unauthenticated by design for this demo (PRD §9). A comment in `apps/backend/src/routes/content.ts` marks the exact line where an API key check or auth middleware would slot in before the routes are exposed publicly.

## Why M3 ships before M5

Building the resolver here — rather than inside the schema-evolution feature — means M5 can import and reuse `resolveEntries` directly in the plan/preview/apply pipeline. It also validates the id→name contract end-to-end (against real seed data) before the migration logic depends on it.
