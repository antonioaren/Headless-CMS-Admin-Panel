import { env } from '@/env'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { Server as SocketServer } from 'socket.io'
import entriesRoutes from './routes/entries.js'
import schemasRoutes from './routes/schemas.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: env.CORS_ORIGIN })

app.get('/health', async () => ({ ok: true }))

await app.register(schemasRoutes, { prefix: '/api' })
await app.register(entriesRoutes, { prefix: '/api' })

await app.listen({ port: env.PORT, host: '0.0.0.0' })

// socket.io shares the Fastify HTTP server. No events emitted yet — wiring lands in M4
// (server emits only AFTER a successful DB write; payloads stay thin).
const io = new SocketServer(app.server, { cors: { origin: env.CORS_ORIGIN } })

io.on('connection', (socket) => {
  app.log.info({ id: socket.id }, 'socket connected')
})
