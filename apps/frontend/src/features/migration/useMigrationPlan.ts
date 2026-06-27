import { apiPost } from '@/lib/api'
import type { MigrationPlan, Schema } from '@cms/shared'
import { useMutation } from '@tanstack/react-query'

export function usePlanMutation(schemaId: string) {
  return useMutation({
    mutationFn: (body: unknown) => apiPost<MigrationPlan>(`/api/schemas/${schemaId}/plan`, body)
  })
}

export function useApplyMutation(schemaId: string) {
  return useMutation({
    mutationFn: (body: unknown) =>
      apiPost<{ schema: Schema; plan: MigrationPlan }>(`/api/schemas/${schemaId}/apply`, body)
  })
}
