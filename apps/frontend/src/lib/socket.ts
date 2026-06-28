import { io } from 'socket.io-client'

// Socket.io uses WebSocket upgrade — must connect directly to the backend, not through the Vite proxy.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

// Try WebSocket first, fall back to polling. The default polling-first behavior
// never upgraded in this setup, leaving every client stuck on HTTP long-polling
// (perpetual reconnect churn). Listing 'websocket' first negotiates the real
// socket immediately; 'polling' stays as a fallback so a failed upgrade isn't fatal.
export const socket = io(BACKEND_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true
})
