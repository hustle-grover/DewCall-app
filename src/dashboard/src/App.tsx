import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import NavBar from './components/NavBar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'
import DailyBrief from './pages/DailyBrief'
import BriefHistory from './pages/BriefHistory'
import MoodTrends from './pages/MoodTrends'
import ParentProfile from './pages/ParentProfile'
import Settings from './pages/Settings'

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-dew-bg">
        <NavBar />
        <main className="flex-1 md:ml-60 pb-20 md:pb-0">
          <div className="max-w-content mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  )
}
