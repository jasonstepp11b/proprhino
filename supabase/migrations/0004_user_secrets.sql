-- Per-user secrets, currently the Anthropic API key used for AI reviews.
-- RLS is on with no policies, so the browser can neither read nor write this
-- table; only edge functions using the service role can.
create table user_secrets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  anthropic_api_key text not null,
  updated_at timestamptz not null default now()
);

alter table user_secrets enable row level security;
revoke all on user_secrets from anon, authenticated;
