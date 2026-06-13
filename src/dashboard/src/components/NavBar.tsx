import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import { Heart, Clock, TrendingUp, User, Settings } from 'lucide-react'

const navItems = [
  { to: '/',        icon: Heart,       label: 'Home',     end: true  },
  { to: '/history', icon: Clock,       label: 'History',  end: false },
  { to: '/trends',  icon: TrendingUp,  label: 'Trends',   end: false },
  { to: '/profile', icon: User,        label: 'About Mum',end: false },
  { to: '/settings',icon: Settings,    label: 'Settings', end: false },
]

export default memo(function NavBar() {
  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 bg-dew-bg border-r border-dew-border z-40">
        <div className="px-6 pt-8 pb-6">
          <span className="font-display text-xl font-semibold text-dew-text tracking-tight">
            Dewcall
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 flex-1" aria-label="Main navigation">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium font-body transition-colors ${
                  isActive
                    ? 'text-dew-primary bg-dew-chip-bg'
                    : 'text-dew-muted hover:text-dew-text hover:bg-dew-border/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Mobile bottom tab bar ────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-dew-surface border-t border-dew-border z-40 flex items-stretch"
        aria-label="Main navigation"
      >
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium font-body transition-colors ${
                isActive ? 'text-dew-primary' : 'text-dew-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
})
