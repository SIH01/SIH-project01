-- STAGE 19 - Razorpay Route payment state.

alter table organizations add column if not exists razorpay_account_id text;
alter table campaign_donations add column if not exists status text not null default 'pending';
alter table campaign_donations add column if not exists gateway_order_id text;
alter table campaign_donations add column if not exists gateway_payment_id text;
alter table campaign_donations add column if not exists confirmed_at timestamptz;

create unique index if not exists idx_campaign_donations_gateway_order
  on campaign_donations(gateway_order_id) where gateway_order_id is not null;
