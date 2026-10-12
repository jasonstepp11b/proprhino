import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Accounts } from '@/pages/Accounts'
import { Compliance } from '@/pages/Compliance'
import { Dashboard } from '@/pages/Dashboard'
import { Ledger } from '@/pages/Ledger'
import { Login } from '@/pages/Login'
import { Performance } from '@/pages/Performance'
import { Playbook } from '@/pages/Playbook'
import { Trades } from '@/pages/Trades'

export default function App() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4 text-sm text-muted-foreground">
        Supabase is not configured. Copy .env.example to .env.local and set both values, then restart the dev server.
      </div>
    )
  }
  if (loading) return null
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="trades" element={<Trades />} />
          <Route path="performance" element={<Performance />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="playbook" element={<Playbook />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
