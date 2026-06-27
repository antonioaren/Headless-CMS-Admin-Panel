import { css } from '@emotion/react'

export const pageShellStyles = css({
  maxWidth: 768,
  margin: '0 auto',
  padding: 32
})

export const pageHeaderStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 24
})

export const entryListStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 0,
  margin: 0,
  listStyle: 'none'
})

export const entryCardStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 20px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#fff',
  boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)'
})

export const entryActionsStyles = css({
  display: 'flex',
  gap: 8
})
