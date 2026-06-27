# Data model

Three fixed tables. Only `entries.data` (JSONB) is dynamic — no dynamic DDL ever runs.

```sql
create table schemas (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,        -- used in /api/content/:slug
  display_name  text not null,
  version       int  not null default 1,     -- bumped on EVERY schema change
  created_at    timestamptz default now()
);

create table fields (
  id                  uuid primary key default gen_random_uuid(),  -- STABLE, never reused
  schema_id           uuid not null references schemas(id) on delete cascade,
  key                 text not null,          -- renamable display label
  type                text not null,          -- text|number|boolean|date|reference
  required            boolean not null default false,
  reference_schema_id uuid references schemas(id),  -- only when type=reference
  position            int not null default 0,
  config              jsonb not null default '{}'   -- e.g. { "default": ... }
);

create table entries (
  id          uuid primary key default gen_random_uuid(),
  schema_id   uuid not null references schemas(id) on delete cascade,
  data        jsonb not null default '{}',   -- keyed by field.id, NOT field name
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

## The four decisions that matter

### 1. Entry data is keyed by `field.id`, never field name

```json
data = { "f_abc": "Tesla", "f_owner": "<entry-uuid>" }
```

Renaming a field becomes a one-row label edit (`fields.key`) with **zero entry migration**. The read API and forms resolve ids → current names on the way out (a small serialization layer).

### 2. References = entry IDs in JSONB, integrity in app code — NOT a DB foreign key

Feature D requires the system to *hold* temporarily-broken state (a retargeted reference pointing at the wrong schema) so it can surface and repair it. A real FK would forbid that state from existing. So integrity is validated in app code, not enforced by the DB.

### 3. Every schema change runs through one MigrationPlan pipeline

Five mutation types, one mechanism — not five bespoke flows. See [schema-evolution.md](./schema-evolution.md).

### 4. `schema.version` is the mid-edit collision detector

Open forms record the version they rendered against; a bump means "your form is stale." See [schema-evolution.md](./schema-evolution.md) §mid-edit.

## Shared types

`packages/shared` exports `Field`, `Schema`, `MigrationPlan` — imported verbatim by both apps so there's zero drift between what the server validates and what the client renders. It also exports the `buildZodSchema(fields)` contract used by both sides for validation.
