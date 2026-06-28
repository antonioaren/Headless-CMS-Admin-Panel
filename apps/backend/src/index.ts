import { env } from '@/env'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { Server as SocketServer } from 'socket.io'
import { initRealtime } from './lib/realtime.js'
import contentRoutes from './routes/content.js'
import entriesRoutes from './routes/entries.js'
import migrationsRoutes from './routes/migrations.js'
import schemasRoutes from './routes/schemas.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: env.CORS_ORIGIN })

app.get('/health', async () => ({ ok: true }))

await app.register(schemasRoutes, { prefix: '/api' })
await app.register(entriesRoutes, { prefix: '/api' })
await app.register(contentRoutes, { prefix: '/api' })
await app.register(migrationsRoutes, { prefix: '/api' })

// socket.io shares the Fastify HTTP server. It MUST be attached before app.listen():
// attaching after the server is already listening makes engine.io register its
// upgrade handler too late, so the browser's WebSocket upgrade probe is dropped and
// the client is stuck on HTTP long-polling forever. Emits only after successful DB
// writes; payloads stay thin.
await app.ready()
const io = new SocketServer(app.server, { cors: { origin: env.CORS_ORIGIN } })

initRealtime(io)

io.on('connection', (socket) => {
  app.log.info({ id: socket.id }, 'socket connected')
})

await app.listen({ port: env.PORT, host: '0.0.0.0' })
