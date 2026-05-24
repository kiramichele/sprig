'use client'

import { useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Debounces saves of `value` through `saveFn`. Returns the current save state
 * so the UI can render "saving…" / "saved ✓" / errors next to the section.
 *
 * - First render does not trigger a save (so initial-state load doesn't appear
 *   to "save").
 * - On every subsequent change, the pending timer is cleared and a new one is
 *   scheduled `delay` ms out — typical debounce.
 * - `status` flips to 'saved' for ~2s on success before returning to 'idle'.
 */
export function useDebouncedSave<T>(
  value: T,
  saveFn: (value: T) => Promise<void>,
  delay: number = 800
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const firstRender = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the latest saveFn in a ref so a new function identity doesn't
  // retrigger the debounce effect (only `value` changes should).
  const saveFnRef = useRef(saveFn)
  useEffect(() => {
    saveFnRef.current = saveFn
  })

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (timer.current) clearTimeout(timer.current)

    timer.current = setTimeout(async () => {
      setStatus('saving')
      try {
        await saveFnRef.current(value)
        setStatus('saved')
        setError(null)
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'failed to save')
      }
    }, delay)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, delay])

  return { status, error }
}
