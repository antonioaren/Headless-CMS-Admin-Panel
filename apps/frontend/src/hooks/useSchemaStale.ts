import type { Schema } from '@cms/shared'
import { useEffect, useRef, useState } from 'react'

/**
 * Mid-edit collision guard (ADR-005). Records the schema version at first render
 * and flips `isStale` when a later refetch (driven by a `schema.updated` socket
 * event) reports a higher version — i.e. the schema changed under an open form.
 * Call `markCurrent()` after the caller reloads to clear the flag and re-baseline.
 */
export function useSchemaStale(schema: Schema | undefined): { isStale: boolean; markCurrent: () => void } {
  const renderedVersionRef = useRef<number | null>(null)
  const [isStale, setIsStale] = useState(false)

  useEffect(() => {
    if (schema && renderedVersionRef.current === null) {
      renderedVersionRef.current = schema.version
    }
  }, [schema])

  useEffect(() => {
    if (schema && renderedVersionRef.current !== null && schema.version > renderedVersionRef.current) {
      setIsStale(true)
    }
  }, [schema])

  function markCurrent() {
    renderedVersionRef.current = schema?.version ?? null
    setIsStale(false)
  }

  return { isStale, markCurrent }
}
