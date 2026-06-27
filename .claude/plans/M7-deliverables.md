# M7 — Deliverables

**Goal:** All four required deliverables present and polished. (→ REQ-DELIV)

## Acceptance (REQ-DELIV — all MUST)
- **Working app** — runs, does what it sets out to.
- **README** — install + run locally, no questions asked (env, docker, dev commands). Already leads with `pnpm install && pnpm dev`; final-pass it.
- **Walkthrough** — async, <10 min video OR <15 slides. **Leads with the Feature D pipeline.** Covers: architecture, data model, how realtime + schema evolution work, trade-offs, what's next.
- **AI session log** — chat export / prompts / screenshots. Own every line.

## Walkthrough talking points (PRD §10 / docs/schema-evolution.md)
1. Id-keyed storage → rename is free; read layer resolves ids → names.
2. JSONB + app-side integrity → system can hold broken state to preview and repair.
3. One MigrationPlan pipeline across all five mutations (plan = dry run = preview).
4. `schema.version` as mid-edit collision signal.
5. Which mid-edit behavior was chosen (ADR-005) and why.
6. Non-goals (PRD §9) — what was deliberately not built, and what's next.

## Verify
Clean clone on a fresh machine → `pnpm install && pnpm dev` works with zero back-and-forth. All four deliverables checkable.
