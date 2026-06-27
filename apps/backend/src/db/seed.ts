import { eq } from 'drizzle-orm'
import { db, pool } from './client'
import { entries, fields, schemas } from './schema'

// Seeds Person + Car (REQ-SEED). Idempotent: guards on schema slug, so re-running
// pnpm dev is a no-op once seeded. The Car.year field is seeded as TEXT holding
// "2024"/"vintage"/"n/a" — the deliberate text->number retype demo for M5.
async function main() {
  const existing = await db.select().from(schemas).where(eq(schemas.slug, 'person'))
  if (existing.length > 0) {
    console.info('seed skipped (already seeded)')
    await pool.end()
    return
  }

  // --- Person ---
  const [person] = await db.insert(schemas).values({ slug: 'person', displayName: 'Person' }).returning()

  const [personName] = await db
    .insert(fields)
    .values({ schemaId: person.id, key: 'name', type: 'text', required: true, position: 0 })
    .returning()

  const [personBirthYear] = await db
    .insert(fields)
    .values({ schemaId: person.id, key: 'birthYear', type: 'number', position: 1 })
    .returning()

  const [ada] = await db
    .insert(entries)
    .values({ schemaId: person.id, data: { [personName.id]: 'Ada Lovelace', [personBirthYear.id]: 1815 } })
    .returning()

  await db
    .insert(entries)
    .values({ schemaId: person.id, data: { [personName.id]: 'Alan Turing', [personBirthYear.id]: 1912 } })

  // --- Car ---
  const [car] = await db.insert(schemas).values({ slug: 'car', displayName: 'Car' }).returning()

  // year is TEXT on purpose — the retype-to-number demo (REQ-D.3 / M5).
  const [carYear] = await db
    .insert(fields)
    .values({ schemaId: car.id, key: 'year', type: 'text', position: 0 })
    .returning()

  const [carElectric] = await db
    .insert(fields)
    .values({ schemaId: car.id, key: 'electric', type: 'boolean', position: 1 })
    .returning()

  const [carPurchased] = await db
    .insert(fields)
    .values({ schemaId: car.id, key: 'purchasedAt', type: 'date', position: 2 })
    .returning()

  // owner reference -> Person (reference nav + read resolver demo).
  const [carOwner] = await db
    .insert(fields)
    .values({
      schemaId: car.id,
      key: 'owner',
      type: 'reference',
      referenceSchemaId: person.id,
      position: 3
    })
    .returning()

  await db.insert(entries).values([
    {
      schemaId: car.id,
      data: {
        [carYear.id]: '2024',
        [carElectric.id]: true,
        [carPurchased.id]: '2024-03-15',
        [carOwner.id]: ada.id
      }
    },
    {
      schemaId: car.id,
      data: { [carYear.id]: 'vintage', [carElectric.id]: false, [carPurchased.id]: '1967-01-01' }
    },
    {
      schemaId: car.id,
      data: { [carYear.id]: 'n/a', [carElectric.id]: false }
    }
  ])

  console.info('seed complete: Person + Car with text year (2024/vintage/n-a)')
  await pool.end()
}

main().catch((err) => {
  console.error('seed failed', err)
  process.exit(1)
})
