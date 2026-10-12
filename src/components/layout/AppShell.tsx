import { CalendarCheck, LayoutDashboard, Receipt, Tags, TrendingUp, Upload, Wallet, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/ledger', label: 'Ledger', icon: Receipt },
  { to: '/trades', label: 'Trades', icon: Upload },
  { to: '/performance', label: 'Performance', icon: TrendingUp },
  { to: '/compliance', label: 'Compliance', icon: CalendarCheck },
  { to: '/playbook', label: 'Playbook', icon: Tags },
]

export function AppShell() {
  return (
    <div className="flex min-h-svh">
      <aside className="flex w-52 shrink-0 flex-col border-r bg-sidebar p-3 text-sidebar-foreground">
        <div className="px-2 py-3 text-sm font-semibold">PropFirm Ledger</div>
        <nav className="grid gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" size="sm" className="mt-auto justify-start" onClick={() => supabase?.auth.signOut()}>
          Sign out
        </Button>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
