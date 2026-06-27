# M0 — Scaffold ✅ done

**Goal:** `pnpm install && pnpm dev` brings up DB + both apps end-to-end. (→ REQ-0, REQ-DATA, REQ-LINT)

**Delivered:** pnpm monorepo (`apps/backend`, `apps/frontend`, `packages/shared`); docker-compose postgres:16; Drizzle 3-table schema + migrate + idempotent seed; Fastify `/health` + socket.io; Vite/React19 health-proof page; Biome lint+format; git init (no commit).

**Verified:** install clean · 3 tables migrated · seed 2 schemas/6 fields/5 entries (Car.year text demo present) · `/health` ok · frontend→proxy→backend ok · lint clean · migrate+seed idempotent.

Full record: `~/.claude/plans/M0-scaffold-boot-to-green.md`.
