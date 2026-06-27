# API contract

## CRUD / management

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

## Read API (Feature E)

Field ids resolved to current names in output.

```
GET /api/content/:slug              all entries of a schema
GET /api/content/:slug/:id          one entry
```

> **Security:** read API is unauthenticated for the demo. A single comment in code marks where an API key / auth middleware would slot in — enough to show intent, not burn time.

## socket.io events

Thin payloads — `id` + `schemaId` + `version`. Clients refetch/patch their cache; payload is never the source of truth.

```
schema.created   schema.updated   schema.deleted
entry.created    entry.updated    entry.deleted
```

**Write path rule:** server emits **only after** a successful DB write.
