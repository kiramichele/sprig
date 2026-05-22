import type { NextConfig } from "next";

// Build-time debug logs to help diagnose Vercel build failures (non-sensitive)
try {
  const present = (k: string) => !!process.env[k]
  // Don't log secret values; only presence and some basic context
  // This runs during Next.js build on the server side / Vercel builder
  // and will appear in the build logs.
  // eslint-disable-next-line no-console
  console.log('BUILD DEBUG: NODE_ENV=', process.env.NODE_ENV)
  // eslint-disable-next-line no-console
  console.log('BUILD DEBUG: NEXT_PUBLIC_SUPABASE_URL present=', present('NEXT_PUBLIC_SUPABASE_URL'))
  // eslint-disable-next-line no-console
  console.log('BUILD DEBUG: NEXT_PUBLIC_SUPABASE_ANON_KEY present=', present('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
  // eslint-disable-next-line no-console
  console.log('BUILD DEBUG: process.cwd=', process.cwd())
} catch (e) {
  // ignore logging failures during build
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
