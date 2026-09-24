-- STAGE 9 — fundraising campaigns + admin verification.
-- No real payment processing in this prototype (per spec) — amount_raised
-- is a manually-tracked number an admin/org can update, ready to be wired
-- to a real payment provider later.

create table if not exists fundraising_campaigns (
  id serial primary key,
  organization_id integer not null references organizations(id) on delete cascade,
  disaster_id integer references disasters(id) on delete set null,
  title text not null,
  description text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  amount_raised numeric(12,2) not null default 0,
  purpose text,
  location_name text,
  supporting_documents text,
  verification_status text not null default 'Pending Verification' check (
    verification_status in ('Pending Verification', 'Verified', 'Rejected')
  ),
  status text not null default 'Pending Verification' check (
    status in ('Pending Verification', 'Active', 'Completed', 'Rejected', 'Suspended')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaigns_status on fundraising_campaigns (status);
-- Persistent public donations are introduced in schema_stage18.sql.

