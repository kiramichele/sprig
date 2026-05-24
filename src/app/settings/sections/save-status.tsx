"use client"

import type { SaveStatus as SaveStatusType } from '@/lib/use-debounced-save'

interface Props {
  status: SaveStatusType
  errorMessage?: string | null
}

/** Tiny status pill rendered next to each section's heading. */
export default function SaveStatus({ status, errorMessage }: Props) {
  if (status === 'idle') {
    return (
      <span
        aria-hidden
        style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: 'rgba(0,0,0,0.12)' }}
      />
    )
  }
  if (status === 'saving') {
    return <span style={{ fontSize: 12, opacity: 0.7 }}>saving…</span>
  }
  if (status === 'saved') {
    return (
      <span style={{ fontSize: 12, color: '#1F7A3D', fontWeight: 700 }}>saved ✓</span>
    )
  }
  return (
    <span style={{ fontSize: 12, color: '#B00020', fontWeight: 700 }}>
      {errorMessage || 'save failed'}
    </span>
  )
}
