import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-dew-bg flex items-center justify-center">
      <div className="w-full max-w-content px-6 space-y-4">
        <div className="h-8 w-48 bg-dew-border rounded-button animate-pulse" />
        <div className="h-4 w-32 bg-dew-border rounded animate-pulse" />
        <div className="mt-8 h-48 bg-dew-border rounded-card animate-pulse" />
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading)  return <LoadingSkeleton />
  if (!user)    return <Navigate to="/login" replace />
  return <>{children}</>
}
