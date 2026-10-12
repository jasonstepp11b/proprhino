-- PropFirm Ledger v1.0 schema.
-- Every table carries user_id and is locked down with RLS so a user only ever
-- sees their own rows. Child tables reference accounts through the composite
-- (id, user_id) key, so a row can never point at another user's account.

create type account_type as enum ('evaluation', 'funded', 'passed', 'blown');
create type account_status as enum ('active', 'archived');
create type platform as enum ('tradovate', 'ninjatrader');
create type expense_category as enum ('challenge_purchase', 'reset_fee', 'activation_fee', 'subscription');
create type trade_direction as enum ('long', 'short');
create type tag_kind as enum ('setup', 'mistake');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  firm_name text not null,
  label text not null,
  account_size numeric(12, 2) not null check (account_size > 0),
  platform platform not null,
  account_type account_type not null default 'evaluation',
  status account_status not null default 'active',
  -- Rule engine inputs; null means the firm has no such rule.
  consistency_pct numeric(5, 2) check (consistency_pct > 0 and consistency_pct <= 100),
  min_trading_days integer check (min_trading_days >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Null account_id = general business overhead.
  account_id uuid,
  category expense_category not null,
  amount numeric(12, 2) not null check (amount > 0),
  incurred_on date not null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references accounts (id, user_id) on delete set null (account_id)
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  gross_amount numeric(12, 2) not null check (gross_amount > 0),
  -- Trader's share of the split, e.g. 80 for an 80/20 split.
  split_pct numeric(5, 2) not null check (split_pct > 0 and split_pct <= 100),
  net_amount numeric(12, 2) not null check (net_amount >= 0),
  paid_on date not null,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references accounts (id, user_id) on delete restrict
);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  platform platform not null,
  filename text not null,
  row_count integer not null,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references accounts (id, user_id) on delete cascade
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  batch_id uuid references import_batches (id) on delete cascade,
  symbol text not null,
  direction trade_direction not null,
  quantity integer not null check (quantity > 0),
  entry_time timestamptz not null,
  exit_time timestamptz not null,
  entry_price numeric(14, 4),
  exit_price numeric(14, 4),
  gross_pnl numeric(12, 2) not null,
  commission numeric(12, 2) not null default 0,
  net_pnl numeric(12, 2) not null,
  -- Trading day the P&L counts toward (drives consistency / min-days rules).
  trade_date date not null,
  -- Stable per-trade key from the parser; makes re-importing a file a no-op.
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references accounts (id, user_id) on delete cascade,
  unique (account_id, dedupe_key),
  unique (id, user_id)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind tag_kind not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name),
  unique (id, user_id)
);

create table trade_tags (
  trade_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (trade_id, tag_id),
  foreign key (trade_id, user_id) references trades (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references tags (id, user_id) on delete cascade
);

create index expenses_user_date_idx on expenses (user_id, incurred_on);
create index expenses_account_idx on expenses (account_id);
create index payouts_user_date_idx on payouts (user_id, paid_on);
create index payouts_account_idx on payouts (account_id);
create index import_batches_account_idx on import_batches (account_id);
create index trades_account_date_idx on trades (account_id, trade_date);
create index trades_user_date_idx on trades (user_id, trade_date);
create index trades_batch_idx on trades (batch_id);
create index trade_tags_tag_idx on trade_tags (tag_id);

do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'expenses', 'payouts', 'import_batches', 'trades', 'tags', 'trade_tags']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end $$;
