import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client can only be created on the client')
  }

  const normalizeEnv = (value: string | undefined) =>
    value?.trim().replace(/^NEXT_PUBLIC_[A-Z_]+=\s*/, '')

  const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  )
}