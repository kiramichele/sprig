const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

const missing = required.filter((k) => !process.env[k])

if (missing.length) {
  console.error('\nMissing required environment variables for build:')
  missing.forEach((m) => console.error(` - ${m}`))
  console.error('\nSet them in Vercel or your environment and retry the build.')
  process.exit(1)
}

console.log('Environment check passed: required NEXT_PUBLIC_* vars present.')
