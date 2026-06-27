import { db } from '@/db/client.js'
import { entries, fields, schemas } from '@/db/schema.js'
import { emit } from '@/lib/realtime.js'
import { buildPlan, diff } from '@cms/shared'
import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'reference'] as const

const proposedFieldSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  referenceSchemaId: z.string().uuid().nullable().optional(),
  position: z.number().int()
})

const migrationBodySchema = z.object({
  displayName: z.string().min(1).optional(),
  fields: z.array(proposedFieldSchema)
})

async function fetchSchemaWithFields(schemaId: string) {
  const [schema] = await db.select().from(schemas).where(eq(schemas.id, schemaId))
  if (!schema) return null
  const schemaFields = await db.select().from(fields).where(eq(fields.schemaId, schemaId)).orderBy(asc(fields.position))
  return { ...schema, fields: schemaFields }
}

const migrationsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/schemas/:id/plan — dry run: compute MigrationPlan, write nothing
  fastify.post('/schemas/:id/plan', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = migrationBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    try {
      const current = await fetchSchemaWithFields(id)
      if (!current) {
        return reply.status(404).send({ error: 'Schema not found' })
      }

      const proposedShape = {
        id,
        fields: parsed.data.fields.map((f) => ({
          id: f.id,
          key: f.key,
          type: f.type,
          required: f.required,
          referenceSchemaId: f.referenceSchemaId ?? null,
          position: f.position
        }))
      }

      // current.fields shape matches the shared Schema.fields interface
      const currentSchema = {
        ...current,
        fields: current.fields.map((f) => ({
          ...f,
          type: f.type as 'text' | 'number' | 'boolean' | 'date' | 'reference',
          config: f.config as Record<string, unknown>
        }))
      }

      const changes = diff(currentSchema, proposedShape)

      const schemaEntries = await db.select().from(entries).where(eq(entries.schemaId, id))
      const entriesForPlan = schemaEntries.map((e) => ({
        id: e.id,
        data: (e.data as Record<string, unknown>) ?? {}
      }))

      const plan = buildPlan(id, changes, entriesForPlan)

      return reply.send({ data: plan })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to compute migration plan' })
    }
  })

  // POST /api/schemas/:id/apply — commit migration in a single transaction
  fastify.post('/schemas/:id/apply', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = migrationBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    try {
      const current = await fetchSchemaWithFields(id)
      if (!current) {
        return reply.status(404).send({ error: 'Schema not found' })
      }

      const proposedFields = parsed.data.fields.map((f) => ({
        id: f.id,
        key: f.key,
        type: f.type,
        required: f.required,
        referenceSchemaId: f.referenceSchemaId ?? null,
        position: f.position
      }))

      const proposedShape = { id, fields: proposedFields }

      const currentSchema = {
        ...current,
        fields: current.fields.map((f) => ({
          ...f,
          type: f.type as 'text' | 'number' | 'boolean' | 'date' | 'reference',
          config: f.config as Record<string, unknown>
        }))
      }

      const changes = diff(currentSchema, proposedShape)

      const schemaEntries = await db.select().from(entries).where(eq(entries.schemaId, id))
      const entriesForPlan = schemaEntries.map((e) => ({
        id: e.id,
        data: (e.data as Record<string, unknown>) ?? {}
      }))

      const plan = buildPlan(id, changes, entriesForPlan)

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(schemas).where(eq(schemas.id, id))
        if (!existing) return null

        // Apply field-level changes
        const existingFieldIds = new Set(current.fields.map((f) => f.id))
        const incomingIds = new Set(proposedFields.filter((f) => f.id).map((f) => f.id as string))

        // Delete fields not in proposed list
        const toDelete = [...existingFieldIds].filter((fid) => !incomingIds.has(fid))
        for (const fid of toDelete) {
          await tx.delete(fields).where(eq(fields.id, fid))
        }

        // Update or insert fields
        for (const f of proposedFields) {
          if (f.id && existingFieldIds.has(f.id)) {
            await tx
              .update(fields)
              .set({
                key: f.key,
                type: f.type,
                required: f.required,
                referenceSchemaId: f.referenceSchemaId ?? null,
                position: f.position
              })
              .where(eq(fields.id, f.id))
          } else if (!f.id) {
            await tx.insert(fields).values({
              id: crypto.randomUUID(),
              schemaId: id,
              key: f.key,
              type: f.type,
              required: f.required,
              referenceSchemaId: f.referenceSchemaId ?? null,
              position: f.position,
              config: {}
            })
          }
        }

        // Apply auto impacts to entries — group by entryId to minimize writes
        const autoImpacts = plan.impact.filter((i) => i.status === 'auto')
        const deleteImpacts = plan.impact.filter(
          (i) => i.status === 'auto' && changes.find((c) => c.fieldId === i.fieldId && c.kind === 'delete')
        )

        if (autoImpacts.length > 0) {
          // Group by entryId
          const byEntry = new Map<string, typeof autoImpacts>()
          for (const impact of autoImpacts) {
            const arr = byEntry.get(impact.entryId) ?? []
            arr.push(impact)
            byEntry.set(impact.entryId, arr)
          }

          for (const [entryId, impacts] of byEntry) {
            const [entry] = await tx.select().from(entries).where(eq(entries.id, entryId))
            if (!entry) continue

            const data = { ...(entry.data as Record<string, unknown>) }

            for (const impact of impacts) {
              const change = changes.find((c) => c.fieldId === impact.fieldId)
              if (!change) continue

              if (change.kind === 'delete') {
                // Remove the key from entry data
                delete data[impact.fieldId]
              } else if (impact.proposedValue !== undefined) {
                data[impact.fieldId] = impact.proposedValue
              }
            }

            await tx.update(entries).set({ data, updatedAt: new Date() }).where(eq(entries.id, entryId))
          }
        }

        // Also handle delete-kind entries that had no value (status 'auto' with no proposedValue means delete the key)
        // Already handled above via kind === 'delete' check inside byEntry loop

        // Bump version and optionally update displayName
        const newVersion = existing.version + 1
        const displayName = parsed.data.displayName
        await tx
          .update(schemas)
          .set({ version: newVersion, ...(displayName !== undefined ? { displayName } : {}) })
          .where(eq(schemas.id, id))

        // Fetch updated schema with fields
        const [updatedSchema] = await tx.select().from(schemas).where(eq(schemas.id, id))
        const updatedFields = await tx
          .select()
          .from(fields)
          .where(eq(fields.schemaId, id))
          .orderBy(asc(fields.position))

        return { schema: { ...updatedSchema, fields: updatedFields }, plan, newVersion }
      })

      if (!result) {
        return reply.status(404).send({ error: 'Schema not found' })
      }

      emit('schema.updated', { id, schemaId: id, version: result.newVersion })
      return reply.send({ data: { schema: result.schema, plan: result.plan } })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to apply migration' })
    }
  })
}

export default migrationsRoutes
