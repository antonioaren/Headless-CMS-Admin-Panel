import { css } from '@emotion/react'

export const fieldEditorStyles = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto auto auto',
  alignItems: 'center',
  gap: 8,
  padding: '8px 0',
  borderBottom: '1px solid #e2e8f0'
})

export const requiredCellStyles = css({
  textAlign: 'center'
})
