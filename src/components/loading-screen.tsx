/**
 * Sprig-themed loading screen used by every route-level loading.tsx.
 * Cream bg + a centered chunky card + spinner. Intentionally lightweight —
 * loading states shouldn't distract from the work the user is waiting on.
 *
 * Doesn't render the TopNav: route-level loading.tsx kicks in before the
 * page's data is fetched, so we usually don't have a profile to feed it.
 */
import Spinner from './spinner'

interface Props {
  /** Optional override copy. Defaults to "loading…" */
  label?: string
}

export default function LoadingScreen({ label = 'loading…' }: Props) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#FFF6E5',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'white',
          border: '2.5px solid #1F1A3D',
          boxShadow: '4px 4px 0 0 #1F1A3D',
          borderRadius: 16,
          padding: '22px 28px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          color: '#1F1A3D',
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        <Spinner size="md" />
        <span>{label}</span>
      </div>
    </main>
  )
}
