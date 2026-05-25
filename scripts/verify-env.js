const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

// Required only in production. Preview builds can fall back to VERCEL_URL,
// and local builds (no VERCEL_ENV) usually use localhost.
const requiredInProd = [
  'NEXT_PUBLIC_APP_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'CRON_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const missing = required.filter((k) => !process.env[k])

if (missing.length) {
  console.error('\nMissing required environment variables for build:')
  missing.forEach((m) => console.error(` - ${m}`))
  console.error('\nSet them in Vercel or your environment and retry the build.')
  process.exit(1)
}

if (process.env.VERCEL_ENV === 'production') {
  const missingProd = requiredInProd.filter((k) => !process.env[k])
  if (missingProd.length) {
    console.error('\nMissing required environment variables for PRODUCTION build:')
    missingProd.forEach((m) => console.error(` - ${m}`))
    console.error('\nSet them in Vercel (Production environment) and retry the build.')
    process.exit(1)
  }
}

console.log('Environment check passed: required NEXT_PUBLIC_* vars present.')
