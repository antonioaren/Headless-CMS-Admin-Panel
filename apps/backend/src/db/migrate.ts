import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client'

// Applies generated SQL migrations from ./drizzle. Idempotent: drizzle tracks
// applied migrations in its own journal table, so re-running is a no-op.
async function main() {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.info('migrations applied')
  await pool.end()
}

main().catch((err) => {
  console.error('migration failed', err)
  process.exit(1)
})
