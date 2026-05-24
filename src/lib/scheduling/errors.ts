/**
 * Extract a human-readable message from anything thrown by Supabase. RPC
 * errors come back as plain `PostgrestError` objects (`{ message, details,
 * hint, code }`), so `err instanceof Error` is false and `String(err)`
 * collapses to `"[object Object]"`. This walks the common shapes.
 */
export function getErrorMessage(err: unknown): string {
  if (!err) return 'unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const e = err as {
      message?: string
      error_description?: string
      details?: string
      hint?: string
      code?: string
    }
    return (
      e.message ||
      e.error_description ||
      e.details ||
      e.hint ||
      e.code ||
      JSON.stringify(err)
    )
  }
  return String(err)
}
