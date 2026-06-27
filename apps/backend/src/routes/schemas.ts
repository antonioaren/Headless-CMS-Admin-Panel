import { db } from '@/db/client.js'
import { entries, fields, schemas } from '@/db/schema.js'
import { asc, eq, inArray } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'reference'] as const

const fieldInputSchema = z.object({
  key: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  referenceSchemaId: z.string().uuid().nullable().optional(),
  position: z.number().int()
})

const createBodySchema = z.object({
  displayName: z.string().min(1),
  fields: z.array(fieldInputSchema)
})

const patchFieldSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  referenceSchemaId: z.string().uuid().nullable().optional(),
  position: z.number().int()
})

const patchBodySchema = z.object({
  displayName: z.string().min(1).optional(),
  fields: z.array(patchFieldSchema).optional()
})

function toSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

async function fetchSchemaWithFields(tx: typeof db, schemaId: string) {
  const [schema] = await tx.select().from(schemas).where(eq(schemas.id, schemaId))
  if (!schema) return null
  const schemaFields = await tx.select().from(fields).where(eq(fields.schemaId, schemaId)).orderBy(asc(fields.position))
  return { ...schema, fields: schemaFields }
}

const schemasRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/schemas
  fastify.get('/schemas', async (_req, reply) => {
    try {
      const allSchemas = await db.select().from(schemas)
      const allFields = await db.select().from(fields).orderBy(asc(fields.position))

      const fieldsBySchemaId: Record<string, typeof allFields> = {}
      for (const f of allFields) {
        if (!fieldsBySchemaId[f.schemaId]) fieldsBySchemaId[f.schemaId] = []
        fieldsBySchemaId[f.schemaId].push(f)
      }

      const data = allSchemas.map((s) => ({
        ...s,
        fields: fieldsBySchemaId[s.id] ?? []
      }))

      return reply.send({ data })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch schemas' })
    }
  })

  // POST /api/schemas
  fastify.post('/schemas', async (req, reply) => {
    const parsed = createBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    const { displayName, fields: fieldInputs } = parsed.data
    const slug = toSlug(displayName)

    try {
      const result = await db.transaction(async (tx) => {
        const [schema] = await tx.insert(schemas).values({ displayName, slug, version: 1 }).returning()

        const fieldRows = fieldInputs.map((f) => ({
          id: crypto.randomUUID(),
          schemaId: schema.id,
          key: f.key,
          type: f.type,
          required: f.required,
          referenceSchemaId: f.referenceSchemaId ?? null,
          position: f.position,
          config: {}
        }))

        if (fieldRows.length > 0) {
          await tx.insert(fields).values(fieldRows)
        }

        const insertedFields = await tx
          .select()
          .from(fields)
          .where(eq(fields.schemaId, schema.id))
          .orderBy(asc(fields.position))

        return { ...schema, fields: insertedFields }
      })

      return reply.status(201).send({ data: result })
    } catch (err) {
      fastify.log.error(err)
      if (err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
        return reply.status(400).send({ error: `Slug '${slug}' already exists` })
      }
      return reply.status(500).send({ error: 'Failed to create schema' })
    }
  })

  // PATCH /api/schemas/:id
  fastify.patch('/schemas/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = patchBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message })
    }

    const { displayName, fields: fieldUpdates } = parsed.data

    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(schemas).where(eq(schemas.id, id))
        if (!existing) return null

        // Always bump version; optionally update displayName
        await tx
          .update(schemas)
          .set({
            version: existing.version + 1,
            ...(displayName !== undefined ? { displayName } : {})
          })
          .where(eq(schemas.id, id))

        if (fieldUpdates !== undefined) {
          const existingFields = await tx.select().from(fields).where(eq(fields.schemaId, id))
          const existingIds = new Set(existingFields.map((f) => f.id))

          const incomingIds = new Set(fieldUpdates.filter((f) => f.id).map((f) => f.id as string))

          // Delete fields not present in incoming list
          const toDelete = [...existingIds].filter((fid) => !incomingIds.has(fid))
          if (toDelete.length > 0) {
            await tx.delete(fields).where(inArray(fields.id, toDelete))
          }

          for (const f of fieldUpdates) {
            if (f.id && existingIds.has(f.id)) {
              // Update existing field
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
              // Insert new field
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
        }

        return fetchSchemaWithFields(tx, id)
      })

      if (!result) {
        return reply.status(404).send({ error: 'Schema not found' })
      }

      return reply.send({ data: result })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to update schema' })
    }
  })

  // DELETE /api/schemas/:id
  fastify.delete('/schemas/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(schemas).where(eq(schemas.id, id))
        if (!existing) return null

        await tx.delete(entries).where(eq(entries.schemaId, id))
        await tx.delete(fields).where(eq(fields.schemaId, id))
        await tx.delete(schemas).where(eq(schemas.id, id))

        return { id }
      })

      if (!result) {
        return reply.status(404).send({ error: 'Schema not found' })
      }

      return reply.send({ data: result })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to delete schema' })
    }
  })
}

export default schemasRoutes
