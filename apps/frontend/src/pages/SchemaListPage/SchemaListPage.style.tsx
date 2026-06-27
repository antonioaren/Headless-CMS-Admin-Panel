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

export const schemaListStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 0,
  margin: 0,
  listStyle: 'none'
})

export const schemaCardStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 20px'
})

export const schemaActionsStyles = css({
  display: 'flex',
  gap: 8
})
