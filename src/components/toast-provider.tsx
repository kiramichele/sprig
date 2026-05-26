"use client"

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ToastVariant = 'success' | 'info' | 'error'

interface ToastRecord {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  /** Add a toast. Returns the id in case the caller wants to dismiss it. */
  showToast: (message: string, variant?: ToastVariant) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_BG: Record<ToastVariant, string> = {
  success: '#6BCB77',
  info: '#FFD23F',
  error: '#FF6B6B',
}

const VARIANT_FG: Record<ToastVariant, string> = {
  success: '#1F1A3D',
  info: '#1F1A3D',
  error: '#FFF6E5',
}

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: '🌱',
  info: '✨',
  error: '⚠️',
}

const AUTO_DISMISS_MS = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, variant }])
    return id
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div
        // The container itself doesn't block clicks; individual toasts re-enable
        // pointer-events so the user can dismiss one with a tap.
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
          maxWidth: 'min(360px, calc(100vw - 32px))',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <button
      onClick={onDismiss}
      style={{
        pointerEvents: 'auto',
        cursor: 'pointer',
        background: VARIANT_BG[toast.variant],
        color: VARIANT_FG[toast.variant],
        border: '2.5px solid #1F1A3D',
        boxShadow: '4px 4px 0 0 #1F1A3D',
        borderRadius: 12,
        padding: '10px 14px',
        fontWeight: 700,
        fontSize: 14,
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        animation: 'sprig-toast-in 0.18s ease-out',
        minWidth: 0,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, flexShrink: 0 }}>{VARIANT_ICON[toast.variant]}</span>
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{toast.message}</span>
      <style>{`
        @keyframes sprig-toast-in {
          from { transform: translateX(16px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </button>
  )
}

/**
 * Hook for any client component that wants to show a toast.
 * Throws if used outside <ToastProvider> so we catch missed wiring early.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
