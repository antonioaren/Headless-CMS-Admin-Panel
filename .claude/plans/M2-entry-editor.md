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

## Files created/modified

- `apps/backend/src/routes/entries.ts` — 5 CRUD routes; PATCH merges existing data before validating
- `apps/backend/src/index.ts` — registers entriesRoutes under `/api`
- `apps/frontend/src/lib/api.ts` — `listEntries`, `getEntry`, `createEntry`, `updateEntry`, `deleteEntry`
- `apps/frontend/src/pages/EntryListPage.tsx` — list with field-keyed summary, Edit/Delete, New Entry
- `apps/frontend/src/pages/EntryFormPage.tsx` — schema-driven form, all 5 types, reference ↗ View nav, RHF + zodResolver
- `apps/frontend/src/App.tsx` — 3 new routes added
- `apps/frontend/src/pages/SchemaListPage.tsx` — Entries button per row

## Status: ✅ DONE (PR #3)

## Verify
- [ ] Add a field to Car schema → control appears in entry form with no code change
- [ ] Create a Car referencing a Person → click ↗ View → navigates to Person entry

## Notes
- `EntryFormPage` renders controls inline (not a separate `EntryForm` component) — simpler for M2 scope; can extract for M5 repair UI if needed
- `buildZodSchema` filled out in `packages/shared/src/zod-builder.ts` — all 5 types covered
- PATCH merges `existing.data` with incoming `data` server-side before validating, so partial updates work safely
