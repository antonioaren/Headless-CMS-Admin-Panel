# M2 — Dynamic entry editor (Feature B)

**Goal:** Create / view / edit / delete entries via a form **generated from the schema**, never hand-written per type. (→ REQ-B)

## Acceptance (REQ-B)
- Each field type renders its control: text→input, number→number, boolean→checkbox, date→date picker, reference→searchable select of target-schema entries.
- Entry `data` keyed by `field.id`.
- Adding a field to a schema makes the new control appear with no code change.
- Reference fields navigable both directions (click owner → Person entry → back).

## Approach
- **Backend**: entry CRUD routes. `POST`/`PATCH` validate the body with `buildZodSchema(fields)` from `@cms/shared` (same builder the client uses → zero drift). `PATCH /api/entries/:id` is also the manual-repair path (M5).
- **Frontend**: a single `<EntryForm schema={...}>` that maps over `schema.fields` and renders a control per `field.type`. RHF + `buildZodSchema(fields)` resolver. The form re-derives whenever the schema object changes (drives the "new field appears" acceptance and M6 mid-edit).
- Reference control: searchable select querying `GET /api/entries?schema=<targetSlug>`; store the selected entry's UUID in `data[field.id]`. Navigation via React Router link to the referenced entry route.

## Files (new)
`apps/backend/src/routes/entries.ts` · `apps/frontend/src/components/EntryForm.tsx` + per-type control components · entry list/detail routes.

## Verify
Add a field to Car schema → control appears in the entry form without edits. Create a Car referencing a Person, click through and back.

## Watch
- The form generator is the heart of B — one renderer, no per-type form components. Reuse it in M5 repair UI and M6 re-derive.
- `buildZodSchema` currently a stub from M0; fill its per-type logic here.
