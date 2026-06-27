# Commit Convention

Commits related to a milestone task MUST follow this schema:

```
<type>(<scope optional>): Mx - description of the task
```

- **`<type>`** — a Conventional Commits type (https://www.conventionalcommits.org/en/v1.0.0/). Any spec verb is allowed: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `build`, `ci`, `perf`, `style`, `revert`. Use `feat!:` / footer `BREAKING CHANGE:` for breaking changes.
- **`<scope>`** — optional. The folder or topic the change relates to (e.g. `backend`, `frontend`, `shared`, `Biome`, `db`). Omit if it spans the whole repo or has no single focus.
- **`Mx`** — the milestone id (`M0`–`M7`, or `M-SEED`). Required on task-related commits; ties the commit to [`TASK.md`](../../TASK.md).
- **description** — the task, lifted from or matching the `TASK.md` checklist item; imperative, lowercase start, no trailing period. May reference a `REQ-x`.

## Examples

```
feat: M0 - seed script (filled in M-SEED) wired into db:seed
feat(Biome): M0 - lint+format wired (root lint/format scripts) — → REQ-LINT
chore(backend): M0 - drizzle schema + migration for schemas/fields/entries
feat(frontend): M1 - schema list + create/edit form
fix(shared): M5 - text→number coercion flags non-numeric as manual
```

## Rules

- One logical task per commit where practical — keep them reviewable.
- Non-task commits (tooling tweaks unrelated to a milestone) may drop the `Mx -` prefix and use plain Conventional Commits.
- No AI attribution / `Co-Authored-By` lines.
- Never commit or push without explicit human approval. Stage specific files — no `git add -A` / `git add .`.
- Milestone work lives on its `feat/Mx-title` branch (see workflow), not `main`.
