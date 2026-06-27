import type { Server } from 'socket.io'

type RealtimePayload = { id: string; schemaId: string; version?: number }
type RealtimeEvent =
  | 'schema.created'
  | 'schema.updated'
  | 'schema.deleted'
  | 'entry.created'
  | 'entry.updated'
  | 'entry.deleted'

let _io: Server | null = null

export function initRealtime(io: Server) {
  _io = io
}

export function emit(event: RealtimeEvent, payload: RealtimePayload) {
  _io?.emit(event, payload)
}
