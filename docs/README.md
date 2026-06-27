# Documentation

Project docs for the Headless CMS Admin Panel. Source-of-truth planning lives at repo root ([PRD.md](../PRD.md), [REQUIREMENT.md](../REQUIREMENT.md), [TASK.md](../TASK.md)); this folder holds the deeper technical docs.

| Doc                                          | Contents                                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| [data-model.md](./data-model.md)             | The three tables, id-keyed storage, app-side integrity        |
| [schema-evolution.md](./schema-evolution.md) | Feature D — MigrationPlan pipeline, coercion rules, repair     |
| [api.md](./api.md)                           | REST + read API + socket.io event contract                    |
| [migration.md](./migration.md)               | Feature D — pipeline impl, endpoints, frontend flow, invariants |
| [decisions.md](./decisions.md)               | Architecture decision log (ADRs) — open + resolved choices     |

## Adding docs

One topic per file, kebab-case name. Link it from this index. Keep prose tight — diagrams and tables over paragraphs.
