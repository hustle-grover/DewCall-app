import { lazy, Suspense, memo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { SeniorProvider, useSenior } from './lib/senior'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import NavBar from './components/NavBar'

const Login         = lazy(() => import('./pages/Login'))
const Signup        = lazy(() => import('./pages/Signup'))
const Onboarding    = lazy(() => import('./pages/Onboarding'))
const DailyBrief    = lazy(() => import('./pages/DailyBrief'))
const BriefHistory  = lazy(() => import('./pages/BriefHistory'))
const MoodTrends    = lazy(() => import('./pages/MoodTrends'))
const ParentProfile = lazy(() => import('./pages/ParentProfile'))
const Settings      = lazy(() => import('./pages/Settings'))

function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-hidden="true">
      <div className="h-8 w-52 bg-dew-border rounded" />
      <div className="h-4 w-36 bg-dew-border rounded" />
      <div className="mt-4 h-48 bg-dew-border rounded-card" />
      <div className="h-24 bg-dew-border rounded-card" />
    </div>
  )
}

// Guards the protected area: shows skeleton while senior loads, redirects if none linked.
function SeniorGate({ children }: { children: React.ReactNode }) {
  const { loading, noSenior } = useSenior()
  if (loading)  return <PageSkeleton />
  if (noSenior) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

// Defined outside App so the component reference is stable across App renders.
// NavBar stays mounted during route transitions; SeniorGate sits above pages.
const ProtectedLayout = memo(function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-dew-bg">
        <NavBar />
        <main className="flex-1 md:ml-60 pb-20 md:pb-0">
          <div className="max-w-content mx-auto px-6 py-8">
            <SeniorGate>
              <Suspense fallback={<PageSkeleton />}>
                {children}
              </Suspense>
            </SeniorGate>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
})

export default function App() {
  return (
    <AuthProvider>
      <SeniorProvider>
        <ToastProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/login"      element={<Login />} />
              <Route path="/signup"     element={<Signup />} />
              <Route path="/onboarding" element={<Onboarding />} />

              <Route path="/"         element={<ProtectedLayout><DailyBrief /></ProtectedLayout>} />
              <Route path="/history"  element={<ProtectedLayout><BriefHistory /></ProtectedLayout>} />
              <Route path="/trends"   element={<ProtectedLayout><MoodTrends /></ProtectedLayout>} />
              <Route path="/profile"  element={<ProtectedLayout><ParentProfile /></ProtectedLayout>} />
              <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </SeniorProvider>
    </AuthProvider>
  )
}
