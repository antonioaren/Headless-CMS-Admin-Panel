import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Three fixed tables. Only entries.data (JSONB) is dynamic — no dynamic DDL.

export const schemas = pgTable('schemas', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(), // used in /api/content/:slug
  displayName: text('display_name').notNull(),
  version: integer('version').notNull().default(1), // bumped on EVERY schema change
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
})

export const fields = pgTable('fields', {
  id: uuid('id').primaryKey().defaultRandom(), // STABLE, never reused
  schemaId: uuid('schema_id')
    .notNull()
    .references(() => schemas.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), // renamable display label
  type: text('type').notNull(), // text|number|boolean|date|reference
  required: boolean('required').notNull().default(false),
  // self-reference only when type=reference; integrity for the VALUES stored in
  // entries.data is enforced in app code, not via a DB FK (ADR-002).
  referenceSchemaId: uuid('reference_schema_id').references(() => schemas.id),
  position: integer('position').notNull().default(0),
  config: jsonb('config').notNull().default({})
})

export const entries = pgTable('entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  schemaId: uuid('schema_id')
    .notNull()
    .references(() => schemas.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull().default({}), // keyed by field.id, NOT field name
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})
