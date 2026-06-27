import { db } from '@/db/client.js'
import { entries, fields, schemas } from '@/db/schema.js'
import { resolveEntries, resolveEntry } from '@/lib/resolve.js'
import { and, asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'

async function getSchemaBySlug(slug: string) {
  const [schema] = await db.select().from(schemas).where(eq(schemas.slug, slug))
  return schema ?? null
}

const contentRoutes: FastifyPluginAsync = async (fastify) => {
  // API-key/auth middleware would slot in here before exposing content reads publicly.

  fastify.get('/content/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }

    try {
      const schema = await getSchemaBySlug(slug)
      if (!schema) {
        return reply.status(404).send({ error: `Schema '${slug}' not found` })
      }

      const schemaFields = await db
        .select()
        .from(fields)
        .where(eq(fields.schemaId, schema.id))
        .orderBy(asc(fields.position))
      const schemaEntries = await db.select().from(entries).where(eq(entries.schemaId, schema.id))
      const data = await resolveEntries(schemaFields, schemaEntries)

      return reply.send({ data })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch content' })
    }
  })

  fastify.get('/content/:slug/:id', async (req, reply) => {
    const { slug, id } = req.params as { slug: string; id: string }

    try {
      const schema = await getSchemaBySlug(slug)
      if (!schema) {
        return reply.status(404).send({ error: `Schema '${slug}' not found` })
      }

      const [entry] = await db
        .select()
        .from(entries)
        .where(and(eq(entries.id, id), eq(entries.schemaId, schema.id)))
      if (!entry) {
        return reply.status(404).send({ error: 'Entry not found' })
      }

      const schemaFields = await db
        .select()
        .from(fields)
        .where(eq(fields.schemaId, schema.id))
        .orderBy(asc(fields.position))
      const data = await resolveEntry(schemaFields, entry)

      return reply.send({ data })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch content entry' })
    }
  })
}

export default contentRoutes
