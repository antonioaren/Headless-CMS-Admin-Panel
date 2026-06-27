// Shared contract types imported verbatim by both apps — zero drift between
// what the server validates and what the client renders/validates.

export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'reference'

export interface Field {
  id: string // STABLE — entry data is keyed by this, never by `key`
  schemaId: string
  key: string // renamable display label
  type: FieldType
  required: boolean
  referenceSchemaId: string | null // only when type === 'reference'
  position: number
  config: Record<string, unknown> // e.g. { default: ... }
}

export interface Schema {
  id: string
  slug: string // used in /api/content/:slug
  displayName: string
  version: number // bumped on EVERY schema change; mid-edit collision signal
  createdAt: string
  fields: Field[]
}

// Entry data is keyed by field.id, NOT field name.
// e.g. { "f_abc": "Tesla", "f_owner": "<entry-uuid>" }
export type EntryData = Record<string, unknown>

export interface Entry {
  id: string
  schemaId: string
  data: EntryData
  createdAt: string
  updatedAt: string
}

// --- Schema evolution (Feature D) — PRD §5.3 ---

export type MigrationKind = 'rename' | 'delete' | 'retype' | 'require' | 'retarget'

export type CellStatus = 'ok' | 'auto' | 'manual'

export interface MigrationChange {
  fieldId: string
  kind: MigrationKind
  from: unknown
  to: unknown
}

export interface MigrationImpact {
  entryId: string
  fieldId: string
  status: CellStatus
  oldValue: unknown
  proposedValue?: unknown
  reason?: string
}

export interface MigrationPlan {
  schemaId: string
  changes: MigrationChange[]
  impact: MigrationImpact[]
  summary: {
    ok: number
    auto: number
    manual: number
    destructive: boolean
  }
}
