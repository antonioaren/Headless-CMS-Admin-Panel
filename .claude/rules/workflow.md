# Workflow & Conventions

## Build order is deliberate — respect it

Milestones (`TASK.md`): M0 scaffold → M1 schema builder → M2 entry editor → **M3 read API** → M4 realtime → **M5 schema evolution (the headline)** → M6 mid-edit+polish → M7 deliverables.

- M3 (read API) ships **before** M5 on purpose: it forces the `id→name` + reference resolver to exist before Feature D builds on top of it. Do not defer the resolver into M5.
- Grading weights Feature D hardest. A small slice that *works* beats a broad one that doesn't. When trading scope, protect D.

## Definition of done for a task

1. Implementation matches the matching `REQ-x` acceptance criteria in `REQUIREMENT.md` (GIVEN/WHEN/THEN).
2. `pnpm lint` exits 0. Run `pnpm exec biome check --write .` — `pnpm format` alone does NOT sort imports.
3. The milestone's "Verify:" line in `TASK.md` passes against the running app.
4. Check the relevant `TASK.md` box(es); keep `docs/decisions.md` current if a decision was made (esp. ADR-005, still OPEN).
5. Confirm `CLAUDE.md` is still accurate; update if commands/architecture/conventions/gotchas changed.

## Code conventions (enforced by Biome — `biome.json`)

- lineWidth 120, single quotes, semicolons as-needed, no trailing commas.
- TypeScript is permissive by design (`strict: false`, `noImplicitAny: false`). `@/*` → `src/*` per app.
- ES modules, `async/await` over `.then()` chains, every `await` has error handling at the call site.
- Comments only where logic is non-obvious — do not narrate.

## Things not to touch

- The seed (`apps/backend/src/db/seed.ts`) seeds `Car.year` as **text** holding `"2024"`/`"vintage"`/`"n/a"` — the deliberate text→number retype demo for M5. Do not change it to a number.
- Env files are named `env.example` (no leading dot) and are optional — defaults baked into `apps/backend/src/env.ts`.
- Run pnpm from the repo root only (a `~/package.json` pins `packageManager: yarn`; our root pins pnpm and stops the upward walk).

## Out of scope (PRD §9 — state as deliberate, don't build)

Auth / multi-tenant / RBAC · pagination & search at scale · rich-text or media fields · nested/array/object fields · optimistic offline / CRDT merge · production deployment · validation beyond type + required.

## Git

Never commit/push without explicit approval. Stage specific files (no `git add -A`). Conventional commits, no AI attribution.
