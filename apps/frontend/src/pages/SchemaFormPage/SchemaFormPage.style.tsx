import { css } from '@emotion/react'

export const pageShellStyles = css({
  maxWidth: 768,
  margin: '0 auto',
  padding: 32
})

export const sectionHeaderStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 8
})

export const fieldStackStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 12
})

export const fieldRowStyles = css({
  display: 'flex',
  alignItems: 'flex-end',
  gap: 4
})

export const fieldRowMainStyles = css({
  flex: 1
})

export const fieldReorderControlsStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingBottom: 8
})
