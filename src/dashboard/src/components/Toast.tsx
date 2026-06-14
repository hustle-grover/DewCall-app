import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 flex flex-col gap-2 items-center md:items-end pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={[
              'px-4 py-3 rounded-card shadow-card text-sm font-body font-medium max-w-sm pointer-events-auto',
              toast.type === 'success' ? 'bg-dew-primary text-white' : '',
              toast.type === 'error'   ? 'bg-dew-flag-bg text-dew-flag-text border border-dew-border' : '',
              toast.type === 'info'    ? 'bg-dew-surface text-dew-text border border-dew-border' : '',
            ].filter(Boolean).join(' ')}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
