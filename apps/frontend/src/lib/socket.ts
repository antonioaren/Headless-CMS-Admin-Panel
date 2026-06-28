import { io } from 'socket.io-client'

// Socket.io uses WebSocket upgrade — must connect directly to the backend, not through the Vite proxy.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

// Default transports: WebSocket with polling fallback. Forcing websocket-only
// breaks live sync if the upgrade fails (no fallback = silent dead socket).
export const socket = io(BACKEND_URL, { autoConnect: true })
