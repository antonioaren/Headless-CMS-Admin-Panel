import type { CellStatus, MigrationChange, MigrationImpact, MigrationKind, MigrationPlan, Schema } from './types'

export interface ProposedField {
  id?: string
  key: string
  type: string
  required: boolean
  referenceSchemaId: string | null
  position: number
}

export interface ProposedSchemaShape {
  id: string
  fields: ProposedField[]
}

/**
 * Compares current schema fields against proposed fields and emits one MigrationChange
 * per detected mutation (rename, delete, retype, require, retarget).
 * New fields (no id) are skipped — they have no existing entry data to migrate.
 */
export function diff(current: Schema, proposed: ProposedSchemaShape): MigrationChange[] {
  const changes: MigrationChange[] = []

  const currentMap = new Map(current.fields.map((f) => [f.id, f]))
  const proposedIds = new Set(proposed.fields.filter((f) => f.id).map((f) => f.id as string))

  // Detect mutations on existing fields
  for (const pf of proposed.fields) {
    if (!pf.id) continue // new field — no existing data
    const cf = currentMap.get(pf.id)
    if (!cf) continue // proposed id not in current — treat as new, skip

    if (pf.key !== cf.key) {
      changes.push({ fieldId: cf.id, kind: 'rename', from: cf.key, to: pf.key })
    }

    if (pf.type !== cf.type) {
      changes.push({ fieldId: cf.id, kind: 'retype', from: cf.type, to: pf.type })
    }

    // require: false → true is the migration event (true → false is non-breaking, skip)
    if (pf.required && !cf.required) {
      changes.push({ fieldId: cf.id, kind: 'require', from: cf.required, to: pf.required })
    }

    if (pf.referenceSchemaId !== cf.referenceSchemaId) {
      changes.push({
        fieldId: cf.id,
        kind: 'retarget',
        from: cf.referenceSchemaId,
        to: pf.referenceSchemaId
      })
    }
  }

  // Detect deletions: current fields whose id is not in proposed list
  for (const cf of current.fields) {
    if (!proposedIds.has(cf.id)) {
      changes.push({ fieldId: cf.id, kind: 'delete', from: cf.key, to: null })
    }
  }

  return changes
}

/**
 * Classifies a single cell (one entry × one field change) as ok | auto | manual.
 * Returns the status plus an optional proposedValue (for auto coercions) and reason (for manual).
 */
export function classifyCell(
  change: MigrationChange,
  value: unknown
): { status: CellStatus; proposedValue?: unknown; reason?: string } {
  switch (change.kind as MigrationKind) {
    case 'rename':
      // Data key is field.id — rename only changes the display label, data is untouched
      return { status: 'ok' }

    case 'delete':
      // Value will be dropped; destructive but automatic
      return { status: 'auto' }

    case 'require': {
      const isEmpty = value === null || value === undefined || value === ''
      if (isEmpty) {
        return { status: 'manual', reason: 'Field is now required but has no value' }
      }
      return { status: 'ok' }
    }

    case 'retarget': {
      const hasValue = value !== null && value !== undefined && value !== ''
      if (hasValue) {
        return { status: 'manual', reason: 'Reference must be re-selected for the new target schema' }
      }
      return { status: 'ok' }
    }

    case 'retype': {
      const fromType = change.from as string
      const toType = change.to as string
      const v = value

      if (toType === 'number') {
        if (v === null || v === undefined || v === '') return { status: 'ok' }
        const n = Number(v)
        if (!Number.isNaN(n)) return { status: 'auto', proposedValue: n }
        return { status: 'manual', reason: 'Cannot convert to number' }
      }

      if (toType === 'text') {
        if (v === null || v === undefined) return { status: 'ok' }
        return { status: 'auto', proposedValue: String(v) }
      }

      if (toType === 'boolean') {
        const s = String(v).toLowerCase()
        if (s === 'true' || v === 1 || v === true) return { status: 'auto', proposedValue: true }
        if (s === 'false' || v === 0 || v === false) return { status: 'auto', proposedValue: false }
        return { status: 'manual', reason: 'Cannot convert to boolean' }
      }

      if (toType === 'date') {
        if (v === null || v === undefined || v === '') return { status: 'ok' }
        const d = Date.parse(String(v))
        if (!Number.isNaN(d)) return { status: 'auto', proposedValue: new Date(d).toISOString() }
        return { status: 'manual', reason: 'Cannot convert to date' }
      }

      // reference ↔ anything, or unhandled combo
      return { status: 'manual', reason: `Cannot automatically convert from ${fromType} to ${toType}` }
    }

    default:
      return { status: 'manual', reason: 'Unknown change kind' }
  }
}

/**
 * Builds a full MigrationPlan from a list of changes and the entries for the schema.
 * Pure — no DB access.
 */
export function buildPlan(
  schemaId: string,
  changes: MigrationChange[],
  entries: Array<{ id: string; data: Record<string, unknown> }>
): MigrationPlan {
  const impact: MigrationImpact[] = []

  for (const entry of entries) {
    for (const change of changes) {
      const oldValue = entry.data[change.fieldId]
      const result = classifyCell(change, oldValue)
      impact.push({
        entryId: entry.id,
        fieldId: change.fieldId,
        status: result.status,
        oldValue,
        proposedValue: result.proposedValue,
        reason: result.reason
      })
    }
  }

  const summary = {
    ok: impact.filter((i) => i.status === 'ok').length,
    auto: impact.filter((i) => i.status === 'auto').length,
    manual: impact.filter((i) => i.status === 'manual').length,
    destructive: changes.some((c) => c.kind === 'delete')
  }

  return { schemaId, changes, impact, summary }
}
