# PropFirm Ledger

Tracks prop firm trading as a business: accounts, expenses, payouts, imported
trades, and payout-rule compliance. See [project_brief.md](project_brief.md).

Stack: Vite + React + TypeScript, Tailwind + shadcn/ui, TanStack Query/Table,
Recharts, PapaParse, Supabase (Postgres + Auth + RLS).

## Setup

```sh
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

Apply the schema by running the files in `supabase/migrations/` in order in the
Supabase SQL editor (or `supabase db push` with the Supabase CLI), then create a
user under Authentication → Users.

## Scripts

- `npm run dev` – dev server
- `npm run build` – typecheck and production build
- `npm test` – unit tests (Vitest)
- `npm run lint` – oxlint

## Layout

- `supabase/migrations/` – schema and RLS policies; run each file in order
- `src/pages/` – one page per module: Dashboard, Accounts, Ledger, Trades, Performance, Compliance, Playbook
- `src/lib/pnl.ts` – Net Business P&L and per-firm summaries
- `src/lib/rules.ts` – consistency rule and minimum trading days, per payout cycle
- `src/lib/performance.ts`, `src/lib/breakdowns.ts`, `src/lib/tags.ts` – trading statistics
- `src/lib/csv/` – Tradovate and NinjaTrader CSV parsers (NinjaTrader is unverified against a real export)
- `src/lib/queries.ts` – Supabase data hooks
- `src/components/ui/` – shadcn/ui components (add more with `npx shadcn@latest add <name>`)
