-- AI-written reviews of trading behaviour. account_id is null for a review
-- covering all accounts. Rows are written by the `review` edge function
-- acting as the signed-in user, so the usual owner policy applies.
create table ai_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid,
  model text not null,
  trade_count integer not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references accounts (id, user_id) on delete cascade
);

create index ai_reviews_user_created_idx on ai_reviews (user_id, created_at desc);

alter table ai_reviews enable row level security;

create policy ai_reviews_owner on ai_reviews for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
