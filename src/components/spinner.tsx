/**
 * Small inline spinner used inside buttons and loading states.
 * Pure CSS, no deps, drops into any flex row alongside text.
 */
interface Props {
  size?: 'sm' | 'md' | 'lg'
  color?: string
  /** Optional accessible label; defaults to "loading". */
  label?: string
}

const SIZE_PX: Record<NonNullable<Props['size']>, number> = {
  sm: 14,
  md: 18,
  lg: 28,
}

export default function Spinner({ size = 'md', color = '#1F1A3D', label = 'loading' }: Props) {
  const px = SIZE_PX[size]
  const border = Math.max(2, Math.round(px / 8))
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        border: `${border}px solid ${color}33`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'sprig-spin 0.7s linear infinite',
        verticalAlign: '-2px',
        flexShrink: 0,
      }}
    >
      <style>{`
        @keyframes sprig-spin { to { transform: rotate(360deg); } }
      `}</style>
    </span>
  )
}
