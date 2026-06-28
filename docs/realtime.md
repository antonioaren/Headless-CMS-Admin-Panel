# Realtime (M4 — Feature C)

## Architecture

Socket.io shares the Fastify HTTP server. The server emits only after a successful DB write; clients invalidate their TanStack Query cache on receipt. The payload is never the source of truth.

```
client A → REST mutation → DB write (tx) → emit event → client B receives → invalidateQueries → refetch
```

## Emit helper

`apps/backend/src/lib/realtime.ts` holds a module-scoped `Server` reference, initialised once from `index.ts` via `initRealtime(io)`. Route files import `emit()` directly — no circular dependency on `index.ts`.

## Events and payloads

All payloads are thin by design (id + schemaId + optional version).

| Event | Trigger | Payload |
|---|---|---|
| `schema.created` | POST /api/schemas | `{ id, schemaId, version }` |
| `schema.updated` | PATCH /api/schemas/:id | `{ id, schemaId, version }` |
| `schema.deleted` | DELETE /api/schemas/:id | `{ id, schemaId }` |
| `entry.created` | POST /api/entries | `{ id, schemaId }` |
| `entry.updated` | PATCH /api/entries/:id | `{ id, schemaId }` |
| `entry.deleted` | DELETE /api/entries/:id | `{ id, schemaId }` |

`schema.updated` carries `version` — M6 uses it for the mid-edit collision check (`renderedSchemaVersion < version` → stale form).

## Frontend

- `apps/frontend/src/lib/socket.ts` — singleton `socket.io-client` instance, connects to `VITE_BACKEND_URL` (defaults to `http://localhost:3000`). Must connect directly to the backend, not through the Vite dev proxy, because the Vite proxy does not support the WebSocket upgrade path used by socket.io.
- `apps/frontend/src/hooks/useRealtimeSync.ts` — subscribes to all 6 events, invalidates the relevant TanStack Query keys (`['schemas']`, `['entries', schemaId]`, `['entry', id]`). Called once at the App root so all pages share a single connection.

## Query invalidation map

| Event | Keys invalidated |
|---|---|
| `schema.created` / `schema.deleted` | `['schemas']` |
| `schema.updated` | `['schemas']`, `['schema', payload.schemaId]` |
| `entry.created` / `entry.updated` / `entry.deleted` | `['entries', payload.schemaId]`, `['entry', payload.id]` |

`['schema', id]` (single schema used in entry forms) IS invalidated on `schema.updated` so `EntryFormPage` receives the new version and can detect stale state. See `docs/mid-edit-collision.md`.
