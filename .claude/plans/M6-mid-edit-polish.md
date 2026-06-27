# M6 — Mid-edit collision (D×C) + polish

**Goal:** Handle a schema changing under an open entry form, plus empty/loading/error states. (→ REQ-D.5, REQ-C)

## Acceptance (REQ-D.5)
- Open entry form records `renderedSchemaVersion`.
- On `schema.updated` for that `schemaId` where `version > renderedSchemaVersion`, the form reacts.
- Pick ONE (record the choice in `docs/decisions.md` ADR-005, still OPEN):
  - **A (minimum):** non-destructive banner "this schema changed; your form is out of date" + block save until reloaded.
  - **B (better, SHOULD):** re-derive form from new schema, re-validate typed values, flag now-invalid fields.

## Approach
- The form already re-derives from its schema object (M2). For **A**: subscribe to realtime (M4), compare versions, show a banner + disable save. For **B**: refetch the schema, feed it to the same generator, re-run the Zod resolver over current values, surface fields that no longer validate.
- Polish pass: empty states (no schemas / no entries), loading + pending states on mutations, error states on failed requests.

## Decision needed
ADR-005 is OPEN. Default to **A** if time-boxed; do **B** only if M5 is solid. Whichever — write the rationale into `docs/decisions.md` and the walkthrough (REQ-D.5 MUST).

## Files
Touch the M2 `EntryForm` + the M4 sync hook. Add shared empty/error UI components.

## Verify
Window A renames a Car field while B has a Car entry open → B reacts per chosen behavior. Walk the empty/loading/error states.
