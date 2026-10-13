import { CalendarCheck, LayoutDashboard, Receipt, Settings as SettingsIcon, Tags, TrendingUp, Upload, Wallet, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Brand } from '@/components/Brand'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/ledger', label: 'Ledger', icon: Receipt },
  { to: '/trades', label: 'Trades', icon: Upload },
  { to: '/performance', label: 'Performance', icon: TrendingUp },
  { to: '/compliance', label: 'Compliance', icon: CalendarCheck },
  { to: '/playbook', label: 'Playbook', icon: Tags },
]

const OTHER: NavItem[] = [{ to: '/settings', label: 'Settings', icon: SettingsIcon }]

function NavSection({ label, items, className }: { label: string; items: NavItem[]; className?: string }) {
  return (
    <div className={className}>
      <div className="px-2 pb-2 text-xs font-medium tracking-wider text-muted-foreground">{label}</div>
      <nav className="grid gap-1">
        {items.map(({ to, label: name, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {name}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col border-r bg-sidebar/80 p-4 text-sidebar-foreground backdrop-blur">
        <Brand className="px-1 pt-1 pb-6 text-lg" />
        <NavSection label="MENU" items={NAV} />
        <NavSection label="OTHER" items={OTHER} className="mt-6" />
        <Button variant="ghost" size="sm" className="mt-auto justify-start" onClick={() => supabase?.auth.signOut()}>
          Sign out
        </Button>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
