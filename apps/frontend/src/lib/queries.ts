import { getEntry, getSchema, listEntriesBySchemaId, listSchemas } from '@/lib/api'
import type { Entry, Schema } from '@cms/shared'
import type { QueryClient } from '@tanstack/react-query'

export const queryKeys = {
  schemas: ['schemas'] as const,
  schema: (schemaId: string) => ['schemas', schemaId] as const,
  entries: (schemaId: string) => ['entries', schemaId] as const,
  entry: (schemaId: string, entryId: string) => ['entries', schemaId, entryId] as const
}

export function schemasQueryOptions() {
  return {
    queryKey: queryKeys.schemas,
    queryFn: listSchemas
  }
}

export function schemaQueryOptions(schemaId: string | undefined, queryClient?: QueryClient) {
  return {
    queryKey: queryKeys.schema(schemaId ?? ''),
    queryFn: () => getSchema(schemaId as string),
    enabled: !!schemaId,
    initialData: () => queryClient?.getQueryData<Schema[]>(queryKeys.schemas)?.find((schema) => schema.id === schemaId),
    initialDataUpdatedAt: () => queryClient?.getQueryState(queryKeys.schemas)?.dataUpdatedAt
  }
}

export function entriesQueryOptions(schemaId: string | undefined) {
  return {
    queryKey: queryKeys.entries(schemaId ?? ''),
    queryFn: () => listEntriesBySchemaId(schemaId as string),
    enabled: !!schemaId,
    // Explicit so reference-field lists stay cache-served across form opens even
    // if the global default changes; socket invalidation still refreshes on writes.
    staleTime: 30_000
  }
}

export function entryQueryOptions(
  schemaId: string | undefined,
  entryId: string | undefined,
  queryClient?: QueryClient
) {
  return {
    queryKey: queryKeys.entry(schemaId ?? '', entryId ?? ''),
    queryFn: () => getEntry(entryId as string),
    enabled: !!schemaId && !!entryId,
    initialData: () =>
      queryClient?.getQueryData<Entry[]>(queryKeys.entries(schemaId ?? ''))?.find((entry) => entry.id === entryId),
    initialDataUpdatedAt: () => queryClient?.getQueryState(queryKeys.entries(schemaId ?? ''))?.dataUpdatedAt
  }
}
