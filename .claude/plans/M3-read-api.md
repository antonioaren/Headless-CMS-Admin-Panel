# M3 — Read API (Feature E)

**Goal:** Bare read endpoints that prove another app could consume the content, with `field.id` keys resolved to current field **names** and references resolved. (→ REQ-E)

> Ships before M5 on purpose — building the `id→name` + reference resolver here is what M5 depends on. Do not defer it.

## Acceptance (REQ-E)
- `GET /api/content/:slug` → all entries of a schema, human-readable field names + resolved values.
- `GET /api/content/:slug/:id` → one entry, resolved.
- A single comment marks where an API key / auth middleware would slot in.

## Approach
- **Resolver** (the reusable piece): given a schema's fields + an entry's `data` (keyed by `field.id`), produce `{ [fieldKey]: value }`. For `reference` fields, look up the referenced entry and emit a readable value (e.g. its first text field or `{ id, label }`). Keep this resolver in a backend module — M5 and the entry detail view reuse it.
- **Routes**: thin handlers over the resolver, keyed by schema `slug`.
- Unauthenticated by design (PRD §9 / REQ-E SHOULD) — leave one comment at the route registration marking the auth seam.

## Files (new)
`apps/backend/src/lib/resolve.ts` (id→name + reference resolver) · `apps/backend/src/routes/content.ts`.

## Verify
`curl /api/content/car` → cars with `year`/`electric`/`owner` names and the owner resolved to a Person, not a raw UUID.

## Watch
- Resolver is shared infrastructure — design it so M5's plan/preview and the entry detail can call it. Don't inline resolution into the route.
