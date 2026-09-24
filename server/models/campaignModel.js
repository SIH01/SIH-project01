const pool = require("../db/pool");

const SELECT_FIELDS = `
  id, organization_id, disaster_id, title, description, target_amount,
  amount_raised, purpose, location_name, supporting_documents,
  verification_status, status, created_at, updated_at
`;

// Public — only campaigns an admin has approved and made Active/Completed.
async function getPublic() {
  const { rows } = await pool.query(
    `select ${SELECT_FIELDS} from fundraising_campaigns
     where verification_status = 'Verified' and status in ('Active', 'Completed')
     order by created_at desc`
  );
  return rows;
}

async function getAll() {
  const { rows } = await pool.query(`select ${SELECT_FIELDS} from fundraising_campaigns order by created_at desc`);
  return rows;
}

async function getByOrganization(organizationId) {
  const { rows } = await pool.query(
    `select ${SELECT_FIELDS} from fundraising_campaigns where organization_id = $1 order by created_at desc`,
    [organizationId]
  );
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query(`select ${SELECT_FIELDS} from fundraising_campaigns where id = $1`, [id]);
  return rows[0] || null;
}

async function getDonations(campaignId) {
  const { rows } = await pool.query(
    `select id, donor_name, amount, created_at
     from campaign_donations where campaign_id = $1 and status = 'confirmed'
     order by created_at desc limit 12`,
    [campaignId]
  );
  return rows;
}

async function createPendingDonation(campaignId, donorName, amount, gatewayOrderId) {
  const { rows } = await pool.query(
    `insert into campaign_donations (campaign_id, donor_name, amount, status, gateway_order_id)
     values ($1, $2, $3, 'pending', $4) returning id, donor_name, amount, status, gateway_order_id`,
    [campaignId, donorName || null, amount, gatewayOrderId]
  );
  return rows[0];
}

async function confirmDonation(gatewayOrderId, gatewayPaymentId) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `select d.*, c.target_amount, c.amount_raised, c.status as campaign_status
       from campaign_donations d join fundraising_campaigns c on c.id = d.campaign_id
       where d.gateway_order_id = $1 for update`,
      [gatewayOrderId]
    );
    const donation = rows[0];
    if (!donation) { await client.query("rollback"); return null; }
    if (donation.status === "confirmed") { await client.query("commit"); return donation; }
    if (donation.campaign_status !== "Active" || Number(donation.amount_raised) + Number(donation.amount) > Number(donation.target_amount)) {
      await client.query("rollback");
      return { rejected: true };
    }
    const updated = await client.query(
      `update campaign_donations set status = 'confirmed', gateway_payment_id = $1, confirmed_at = now() where id = $2 returning *`,
      [gatewayPaymentId, donation.id]
    );
    await client.query(`update fundraising_campaigns set amount_raised = amount_raised + $1, updated_at = now() where id = $2`, [donation.amount, donation.campaign_id]);
    await client.query("commit");
    return updated.rows[0];
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

async function addDonation(campaignId, donorName, amount) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const campaignResult = await client.query(
      `select ${SELECT_FIELDS} from fundraising_campaigns
       where id = $1 and verification_status = 'Verified' and status = 'Active'
       for update`,
      [campaignId]
    );
    const campaign = campaignResult.rows[0];
    if (!campaign) {
      await client.query("rollback");
      return null;
    }
    if (Number(campaign.amount_raised) >= Number(campaign.target_amount)) {
      await client.query("rollback");
      return { fullyFunded: true, campaign };
    }
    const remaining = Number(campaign.target_amount) - Number(campaign.amount_raised);
    if (Number(amount) > remaining) {
      await client.query("rollback");
      return { exceedsGoal: true, campaign, remaining };
    }

    await client.query(
      `insert into campaign_donations (campaign_id, donor_name, amount) values ($1, $2, $3)`,
      [campaignId, donorName || null, amount]
    );
    const updatedResult = await client.query(
      `update fundraising_campaigns set amount_raised = amount_raised + $1, updated_at = now()
       where id = $2 returning ${SELECT_FIELDS}`,
      [amount, campaignId]
    );
    const donationsResult = await client.query(
      `select id, donor_name, amount, created_at from campaign_donations
       where campaign_id = $1 order by created_at desc limit 12`,
      [campaignId]
    );
    await client.query("commit");
    return { campaign: updatedResult.rows[0], donations: donationsResult.rows };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function create(data) {
  const {
    organization_id, disaster_id, title, description, target_amount,
    purpose, location_name, supporting_documents,
  } = data;
  const { rows } = await pool.query(
    `insert into fundraising_campaigns
      (organization_id, disaster_id, title, description, target_amount, purpose, location_name, supporting_documents)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning ${SELECT_FIELDS}`,
    [organization_id, disaster_id || null, title, description, target_amount,
     purpose || null, location_name || null, supporting_documents || null]
  );
  return rows[0];
}

// Admin-only — approve/reject sets verification_status; status tracks the
// campaign's own lifecycle once verified (Active/Completed/Suspended).
async function setVerification(id, verification_status, status) {
  const { rows } = await pool.query(
    `update fundraising_campaigns set
       verification_status = $1,
       status = coalesce($2, status),
       updated_at = now()
     where id = $3
     returning ${SELECT_FIELDS}`,
    [verification_status, status || null, id]
  );
  return rows[0] || null;
}

// Manual amount-raised update (no real payment processing in this
// prototype, per spec — this is the seam a real payment provider plugs into).
async function addToAmountRaised(id, amount) {
  const { rows } = await pool.query(
    `update fundraising_campaigns set amount_raised = amount_raised + $1, updated_at = now()
     where id = $2 returning ${SELECT_FIELDS}`,
    [amount, id]
  );
  return rows[0] || null;
}

module.exports = { getPublic, getAll, getByOrganization, getById, getDonations, createPendingDonation, confirmDonation, addDonation, create, setVerification, addToAmountRaised };
