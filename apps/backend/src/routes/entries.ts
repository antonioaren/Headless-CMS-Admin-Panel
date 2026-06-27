import { db } from '@/db/client.js'
import { entries, fields, schemas } from '@/db/schema.js'
import { emit } from '@/lib/realtime.js'
import { buildZodSchema } from '@cms/shared'
import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

const entriesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/entries?schema=:slug
  fastify.get('/entries', async (req, reply) => {
    const { schema: slug } = req.query as { schema?: string }

    try {
      if (slug) {
        const [schema] = await db.select().from(schemas).where(eq(schemas.slug, slug))
        if (!schema) {
          return reply.status(404).send({ error: `Schema '${slug}' not found` })
        }
        const schemaEntries = await db.select().from(entries).where(eq(entries.schemaId, schema.id))
        return reply.send({ data: schemaEntries })
      }

      const allEntries = await db.select().from(entries)
      return reply.send({ data: allEntries })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch entries' })
    }
  })

  // POST /api/entries — body: { schemaId, data }
  fastify.post('/entries', async (req, reply) => {
    const body = req.body as { schemaId?: string; data?: unknown }

    if (!body.schemaId || typeof body.schemaId !== 'string') {
      return reply.status(400).send({ error: 'schemaId is required' })
    }

    try {
      const schemaFields = await db
        .select()
        .from(fields)
        .where(eq(fields.schemaId, body.schemaId))
        .orderBy(asc(fields.position))

      const zodSchema = buildZodSchema(schemaFields as Parameters<typeof buildZodSchema>[0])
      const parsed = zodSchema.safeParse(body.data ?? {})
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message })
      }

      const [entry] = await db.insert(entries).values({ schemaId: body.schemaId, data: parsed.data }).returning()

      emit('entry.created', { id: entry.id, schemaId: entry.schemaId })
      return reply.status(201).send({ data: entry })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to create entry' })
    }
  })

  // GET /api/entries/:id
  fastify.get('/entries/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    try {
      const [entry] = await db.select().from(entries).where(eq(entries.id, id))
      if (!entry) {
        return reply.status(404).send({ error: 'Entry not found' })
      }
      return reply.send({ data: entry })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch entry' })
    }
  })

  // PATCH /api/entries/:id — body: { data }
  fastify.patch('/entries/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { data?: unknown }

    try {
      const [existing] = await db.select().from(entries).where(eq(entries.id, id))
      if (!existing) {
        return reply.status(404).send({ error: 'Entry not found' })
      }

      const schemaFields = await db
        .select()
        .from(fields)
        .where(eq(fields.schemaId, existing.schemaId))
        .orderBy(asc(fields.position))

      // Merge existing data with incoming partial data, then validate merged result
      const merged = {
        ...(existing.data as Record<string, unknown>),
        ...((body.data as Record<string, unknown>) ?? {})
      }

      const zodSchema = buildZodSchema(schemaFields as Parameters<typeof buildZodSchema>[0])
      const parsed = zodSchema.safeParse(merged)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message })
      }

      const [updated] = await db
        .update(entries)
        .set({ data: parsed.data, updatedAt: new Date() })
        .where(eq(entries.id, id))
        .returning()

      emit('entry.updated', { id: updated.id, schemaId: updated.schemaId })
      return reply.send({ data: updated })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to update entry' })
    }
  })

  // DELETE /api/entries/:id
  fastify.delete('/entries/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    try {
      const [existing] = await db.select().from(entries).where(eq(entries.id, id))
      if (!existing) {
        return reply.status(404).send({ error: 'Entry not found' })
      }

      await db.delete(entries).where(eq(entries.id, id))
      emit('entry.deleted', { id: existing.id, schemaId: existing.schemaId })
      return reply.send({ data: { id } })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to delete entry' })
    }
  })
}

export default entriesRoutes
