import { socket } from '@/lib/socket'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

type Payload = { id: string; schemaId: string; version?: number }

export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    function onSchemaChange(_payload: Payload) {
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
    }

    function onEntryChange(payload: Payload) {
      queryClient.invalidateQueries({ queryKey: ['entries', payload.schemaId] })
      queryClient.invalidateQueries({ queryKey: ['entry', payload.id] })
    }

    socket.on('schema.created', onSchemaChange)
    socket.on('schema.updated', onSchemaChange)
    socket.on('schema.deleted', onSchemaChange)
    socket.on('entry.created', onEntryChange)
    socket.on('entry.updated', onEntryChange)
    socket.on('entry.deleted', onEntryChange)

    return () => {
      socket.off('schema.created', onSchemaChange)
      socket.off('schema.updated', onSchemaChange)
      socket.off('schema.deleted', onSchemaChange)
      socket.off('entry.created', onEntryChange)
      socket.off('entry.updated', onEntryChange)
      socket.off('entry.deleted', onEntryChange)
    }
  }, [queryClient])
}
