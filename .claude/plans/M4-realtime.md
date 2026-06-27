# M4 — Realtime (Feature C)

**Goal:** What one client changes, others see without refresh. (→ REQ-C)

## Acceptance (REQ-C)
- Transport socket.io; server emits **only after** a successful DB write.
- Thin payloads (`id` + `schemaId` + `version`); clients refetch/patch the TanStack Query cache, never trust the payload as source of truth.
- Events: `schema.created/updated/deleted`, `entry.created/updated/deleted`.
- 2 windows: create entry in A → appears live in B. Rename field in A → B's open form reacts (hands to M6).

## Approach
- **Backend**: a tiny emit helper `emit(event, { id, schemaId, version })`. Call it at the END of each mutation handler, after the transaction commits — never before. Wire into all schema + entry mutations (and into M5's `apply`).
- **Frontend**: a socket client module + a hook that, on each event, calls `queryClient.invalidateQueries`/`setQueryData` for the affected keys. Keep cache keys consistent with the query keys M1/M2 already use.

## Files (new)
`apps/backend/src/lib/realtime.ts` (io instance + emit helper; io already created in `index.ts` at M0) · `apps/frontend/src/lib/socket.ts` + a `useRealtimeSync` hook.

## Verify
Two browser windows on the Car entry list → create in A, see it in B. Rename a Car field in A → B's open form reacts.

## Watch
- Emit AFTER commit, thin payload only — this is an architecture invariant (write-path rule). See [architecture-invariants](../rules/architecture-invariants.md).
- `schema.updated` carries `version` — M6 uses it for the mid-edit collision check.
