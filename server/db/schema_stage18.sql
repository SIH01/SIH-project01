-- STAGE 18 - persistent public campaign donations.
-- This records simulated contributions; payment providers should confirm
-- successful payment before the application inserts a donation.

create table if not exists campaign_donations (
  id serial primary key,
  campaign_id integer not null references fundraising_campaigns(id) on delete cascade,
  donor_name text,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_campaign_donations_campaign
  on campaign_donations(campaign_id, created_at desc);
