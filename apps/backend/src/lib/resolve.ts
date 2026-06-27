import { db } from '@/db/client.js'
import { entries, fields } from '@/db/schema.js'
import { asc, inArray } from 'drizzle-orm'

type FieldRow = typeof fields.$inferSelect
type EntryRow = typeof entries.$inferSelect

type ResolvedReference = {
  id: string
  label: string
}

type ResolvedData = Record<string, unknown | ResolvedReference>

export type ResolvedEntry = Omit<EntryRow, 'data'> & {
  data: ResolvedData
}

function getEntryData(entry: EntryRow): Record<string, unknown> {
  return entry.data as Record<string, unknown>
}

function getReadableLabel(entry: EntryRow, entryFields: FieldRow[]): string {
  const data = getEntryData(entry)
  const textField = entryFields.find((field) => field.type === 'text')
  const value = textField ? data[textField.id] : undefined

  return typeof value === 'string' && value.trim().length > 0 ? value : entry.id
}

async function buildReferenceLabels(
  schemaFields: FieldRow[],
  schemaEntries: EntryRow[]
): Promise<Map<string, ResolvedReference>> {
  const referencedIds = new Set<string>()

  for (const entry of schemaEntries) {
    const data = getEntryData(entry)

    for (const field of schemaFields) {
      if (field.type !== 'reference') continue

      const value = data[field.id]
      if (typeof value === 'string' && value.length > 0) {
        referencedIds.add(value)
      }
    }
  }

  if (referencedIds.size === 0) return new Map()

  const referencedEntries = await db
    .select()
    .from(entries)
    .where(inArray(entries.id, [...referencedIds]))
  const referencedSchemaIds = [...new Set(referencedEntries.map((entry) => entry.schemaId))]
  const referencedFields =
    referencedSchemaIds.length > 0
      ? await db
          .select()
          .from(fields)
          .where(inArray(fields.schemaId, referencedSchemaIds))
          .orderBy(asc(fields.position))
      : []

  const fieldsBySchemaId = new Map<string, FieldRow[]>()
  for (const field of referencedFields) {
    const schemaFields = fieldsBySchemaId.get(field.schemaId) ?? []
    schemaFields.push(field)
    fieldsBySchemaId.set(field.schemaId, schemaFields)
  }

  return new Map(
    referencedEntries.map((entry) => [
      entry.id,
      {
        id: entry.id,
        label: getReadableLabel(entry, fieldsBySchemaId.get(entry.schemaId) ?? [])
      }
    ])
  )
}

export async function resolveEntries(schemaFields: FieldRow[], schemaEntries: EntryRow[]): Promise<ResolvedEntry[]> {
  const referenceLabels = await buildReferenceLabels(schemaFields, schemaEntries)

  return schemaEntries.map((entry) => {
    const rawData = getEntryData(entry)
    const data: ResolvedData = {}

    for (const field of schemaFields) {
      const value = rawData[field.id]

      if (field.type === 'reference' && typeof value === 'string' && value.length > 0) {
        data[field.key] = referenceLabels.get(value) ?? { id: value, label: value }
        continue
      }

      data[field.key] = value
    }

    return { ...entry, data }
  })
}

export async function resolveEntry(schemaFields: FieldRow[], entry: EntryRow): Promise<ResolvedEntry> {
  const [resolved] = await resolveEntries(schemaFields, [entry])
  return resolved
}
