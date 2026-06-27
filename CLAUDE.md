# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules (must follow)

@.claude/rules/architecture-invariants.md
@.claude/rules/workflow.md
@.claude/rules/commit-convention.md
@.claude/rules/frontend-styling.md

## What this is

A headless CMS admin panel built for The Agile Monkeys frontend challenge. Define content schemas, manage entries through them, with live multi-client sync. **The graded core is schema evolution (Feature D)** — everything else exists to make D demonstrable. Planning docs are source-of-truth and worth reading before non-trivial work: `PRD.md` (product spec), `REQUIREMENT.md` (acceptance criteria), `TASK.md` (milestone progress), `docs/` (data model, schema-evolution, api, decisions).

## Commands

Run from repo root. `pnpm dev` is the one command a reviewer needs.

```bash
pnpm install              # workspace install
pnpm dev                  # db up → migrate → seed → both apps in parallel
pnpm db:up                # start Postgres (docker)
pnpm db:migrate           # drizzle-kit generate && apply migrations (idempotent)
pnpm db:seed              # seed Person/Car (idempotent — guards on 'person' slug)
pnpm lint                 # biome check . (includes import-sort — must exit 0)
pnpm format               # biome format --write .
pnpm exec biome check --write .   # auto-fix lint AND import sorting (format alone does NOT sort imports)
```

Per-app: `pnpm --filter backend dev`, `pnpm --filter frontend dev`. Backend on :3000, frontend on :5173.

No test runner is wired yet (tests arrive with feature milestones). House testing convention when added: Jest + co-located `*.spec.ts`.

## Stack

React 19 + Vite (SPA) · React Router · TanStack Query · React Hook Form + Zod · Fastify · socket.io · Postgres + JSONB · Drizzle ORM · pnpm workspaces · Biome (lint+format) · Docker for Postgres only (apps run natively).

## Architecture — the load-bearing decisions

Read `docs/data-model.md` and `docs/schema-evolution.md` for the full rationale. The non-obvious parts:

- **Monorepo**: `apps/backend`, `apps/frontend`, `packages/shared`. `@cms/shared` exports `Field`/`Schema`/`Entry`/`MigrationPlan` types + `buildZodSchema(fields)`, imported verbatim by both apps so there is **zero drift** between what the server validates and what the client renders. Touch a contract type → both sides update from one place.

- **Three fixed tables only** (`schemas`, `fields`, `entries`). No dynamic DDL ever. Only `entries.data` (JSONB) is dynamic. Drizzle types the 3 fixed tables; `entries.data` stays hand-shaped JSONB.

- **`entries.data` is keyed by `field.id`, never field name** — e.g. `{ "f_abc": "Tesla" }`. This is why renaming a field is a one-row label edit with zero entry migration. Any read path (read API, forms) must resolve `field.id` → current `key` (name) on the way out.

- **References are entry UUIDs stored in JSONB, integrity enforced in app code — NOT a DB foreign key.** Deliberate: Feature D must be able to *hold* temporarily-broken state (a retargeted reference pointing at the wrong schema) so it can surface and repair it. A real FK would forbid that state. Do not add an FK on reference values.

- **Write path (the rule)**: client → REST mutation → DB write (transaction) → on success, socket.io emit → all clients patch their TanStack Query cache. The socket payload is thin (id + schemaId + version) and is a signal to refetch/patch — **never the source of truth**. The server emits only *after* a successful DB write.

- **`schema.version`** is bumped on every schema change and is the mid-edit collision signal: open forms record `renderedSchemaVersion`; a bump means the form is stale.

- **Schema evolution = one `MigrationPlan` pipeline for all five mutation types** (rename/delete/retype/require/retarget). `diff → classify each affected cell as ok|auto|manual → MigrationPlan`. `POST /api/schemas/:id/plan` is a dry run (the preview, commits nothing); `POST /api/schemas/:id/apply` commits in one transaction. The UI always calls `plan` first and only `apply` on explicit confirm. Do not build per-mutation flows — extend the one pipeline.

## Conventions

- **Biome enforces** lineWidth 120, single quotes, semicolons as-needed, no trailing commas. `pnpm lint` includes import-sort, so run `biome check --write` (not just `format`) before considering lint clean.
- TypeScript is **permissive by design** (`strict: false`, `noImplicitAny: false`). `@/*` → `src/*` per app.
- Seed (`apps/backend/src/db/seed.ts`) deliberately seeds `Car.year` as **text** holding `"2024"`/`"vintage"`/`"n/a"` — the text→number retype demo for Feature D. Don't "fix" it to a number.
- Env files are named `env.example` (no leading dot) and are optional — defaults are baked into `src/env.ts`, so `pnpm dev` runs with no `.env`.

## Gotchas

- **pnpm + the home-dir package.json**: a `~/package.json` on this machine pins `packageManager: yarn`. pnpm walks up looking for `packageManager` and would refuse. Our root `package.json` pins `pnpm@9`, which stops the walk — so always run pnpm from this repo root, not a subdirectory above it.
- `pnpm db:migrate` runs `drizzle-kit generate` first, so a clean checkout produces SQL before applying. Generated SQL lives in `apps/backend/drizzle/`.
- Migrate and seed are both idempotent — re-running `pnpm dev` is a safe no-op.
