const {
  getPublic, getAll, getByOrganization, getById, getDonations, createPendingDonation, confirmDonation, addDonation, create, setVerification, addToAmountRaised,
} = require("../models/campaignModel");
const { getByUserId, getById: getOrgById } = require("../models/organizationModel");
const { logAdminAction } = require("../utils/auditLog");
const { notify } = require("../utils/notify");
const crypto = require("crypto");

const VERIFICATION_STATUSES = ["Pending Verification", "Verified", "Rejected"];
const STATUSES = ["Pending Verification", "Active", "Completed", "Rejected", "Suspended"];

function validateInput(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push("Campaign title is required.");
  if (!body.description || !body.description.trim()) errors.push("Description is required.");
  if (!body.target_amount || Number.isNaN(body.target_amount) || body.target_amount <= 0) {
    errors.push("Target amount must be a positive number.");
  }
  return errors;
}

// POST /api/campaigns — organization only, and only once verified
// (Section 17: "Create fundraising campaigns after verification").
async function createCampaign(req, res) {
  const body = { ...req.body, target_amount: parseFloat(req.body.target_amount) };
  const errors = validateInput(body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  try {
    const org = await getByUserId(req.user.id);
    if (!org) return res.status(404).json({ error: "Organization profile not found." });
    if (org.verification_status !== "Verified") {
      return res.status(403).json({ error: "Your organization must be verified before creating campaigns." });
    }

    const campaign = await create({ ...body, organization_id: org.id });
    res.status(201).json({ campaign });
  } catch (err) {
    console.error("createCampaign error:", err.message);
    res.status(500).json({ error: "Could not create campaign." });
  }
}

// GET /api/campaigns — public, verified + Active/Completed only.
async function listPublicCampaigns(req, res) {
  try {
    const campaigns = await getPublic();
    res.json({ campaigns });
  } catch (err) {
    console.error("listPublicCampaigns error:", err.message);
    res.status(500).json({ error: "Could not load campaigns." });
  }
}

// GET /api/campaigns/admin/all — admin only, every status.
async function listAllCampaigns(req, res) {
  try {
    const campaigns = await getAll();
    res.json({ campaigns });
  } catch (err) {
    console.error("listAllCampaigns error:", err.message);
    res.status(500).json({ error: "Could not load campaigns." });
  }
}

// GET /api/campaigns/mine — organization only, its own campaigns of any status.
async function listMyCampaigns(req, res) {
  try {
    const org = await getByUserId(req.user.id);
    if (!org) return res.status(404).json({ error: "Organization profile not found." });
    const campaigns = await getByOrganization(org.id);
    res.json({ campaigns });
  } catch (err) {
    console.error("listMyCampaigns error:", err.message);
    res.status(500).json({ error: "Could not load your campaigns." });
  }
}

// GET /api/campaigns/:id — public.
async function getCampaignById(req, res) {
  try {
    const campaign = await getById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    const donations = await getDonations(req.params.id);
    res.json({ campaign, donations });
  } catch (err) {
    console.error("getCampaignById error:", err.message);
    res.status(500).json({ error: "Could not load campaign." });
  }
}

// Public prototype donation. A real payment provider should confirm payment
// before this transaction is created.
async function donateToCampaign(req, res) {
  const amount = Number(req.body.amount);
  const donorName = typeof req.body.donorName === "string" ? req.body.donorName.trim().slice(0, 80) : "";
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Donation amount must be greater than zero." });
  }
  if (amount > 10000000) {
    return res.status(400).json({ error: "Donation amount is too large." });
  }
  try {
    const result = await addDonation(req.params.id, donorName, amount.toFixed(2));
    if (!result) return res.status(404).json({ error: "Active campaign not found." });
    if (result.fullyFunded) return res.status(409).json({ error: "This campaign is fully funded.", campaign: result.campaign });
    if (result.exceedsGoal) return res.status(400).json({ error: `The most you can donate is ₹${result.remaining.toFixed(2)}.`, campaign: result.campaign });
    res.status(201).json(result);
  } catch (err) {
    console.error("donateToCampaign error:", err.message);
    res.status(500).json({ error: "Could not record donation." });
  }
}

async function createPaymentOrder(req, res) {
  const amount = Number(req.body.amount);
  const donorName = typeof req.body.donorName === "string" ? req.body.donorName.trim().slice(0, 80) : "";
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Donation amount must be greater than zero." });
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(503).json({ error: "Online donations are not configured yet." });
  try {
    const campaign = await getById(req.params.id);
    const organization = campaign && await getOrgById(campaign.organization_id);
    if (!campaign || campaign.status !== "Active" || campaign.verification_status !== "Verified") return res.status(404).json({ error: "Active campaign not found." });
    if (!organization?.razorpay_account_id) return res.status(409).json({ error: "This organization has not connected its Razorpay bank account yet." });
    const remaining = Number(campaign.target_amount) - Number(campaign.amount_raised);
    if (amount > remaining) return res.status(400).json({ error: `The most you can donate is ₹${remaining.toFixed(2)}.` });
    const gatewayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(amount * 100), currency: "INR", receipt: `campaign_${campaign.id}_${Date.now()}`, transfers: [{ account: organization.razorpay_account_id, amount: Math.round(amount * 100), currency: "INR" }] }),
    });
    if (!gatewayResponse.ok) throw new Error(`Razorpay order failed: ${gatewayResponse.status}`);
    const order = await gatewayResponse.json();
    await createPendingDonation(campaign.id, donorName, amount.toFixed(2), order.id);
    res.status(201).json({ keyId, orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error("createPaymentOrder error:", err.message);
    res.status(500).json({ error: "Could not start payment." });
  }
}

async function razorpayWebhook(req, res) {
  const signature = req.get("X-Razorpay-Signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!signature || !secret || !req.rawBody) return res.status(400).json({ error: "Invalid webhook." });
  const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: "Invalid webhook signature." });
  const payment = req.body.payload?.payment?.entity;
  if (req.body.event === "payment.captured" && payment?.order_id) await confirmDonation(payment.order_id, payment.id);
  res.json({ received: true });
}

// PUT /api/campaigns/:id/verify — admin only. Approve/reject/suspend/complete.
async function verifyCampaign(req, res) {
  const { verification_status, status } = req.body;
  if (verification_status && !VERIFICATION_STATUSES.includes(verification_status)) {
    return res.status(400).json({ error: "Verification status must be one of: " + VERIFICATION_STATUSES.join(", ") });
  }
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status must be one of: " + STATUSES.join(", ") });
  }
  try {
    const existing = await getById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Campaign not found." });

    // A verification_status of "Verified" with no explicit status also
    // activates the campaign, since that's the normal approve-and-go-live path.
    const nextVerification = verification_status || existing.verification_status;
    const nextStatus = status || (verification_status === "Verified" ? "Active" : undefined);

    const campaign = await setVerification(req.params.id, nextVerification, nextStatus);
    await logAdminAction(req.user.id, "campaign.verify", "campaign", campaign.id, JSON.stringify({ verification_status, status }));

    const org = await getOrgById(campaign.organization_id);
    if (org?.user_id) {
      await notify(org.user_id, "Campaign status update", `"${campaign.title}" is now: ${campaign.status} (${campaign.verification_status}).`);
    }
    res.json({ campaign });
  } catch (err) {
    console.error("verifyCampaign error:", err.message);
    res.status(500).json({ error: "Could not update campaign." });
  }
}

// PUT /api/campaigns/:id/amount — admin or the owning organization can log
// funds received (manual — no live payment processing in this prototype).
// requireAuth alone doesn't distinguish "this org" from "any org", so that
// check happens here rather than in route middleware.
async function addAmount(req, res) {
  const amount = parseFloat(req.body.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number." });
  }
  try {
    const existing = await getById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Campaign not found." });

    if (req.user.role !== "admin") {
      const org = await getByUserId(req.user.id);
      if (!org || org.id !== existing.organization_id) {
        return res.status(403).json({ error: "You can only update your own organization's campaigns." });
      }
    }

    const campaign = await addToAmountRaised(req.params.id, amount);
    res.json({ campaign });
  } catch (err) {
    console.error("addAmount error:", err.message);
    res.status(500).json({ error: "Could not update amount raised." });
  }
}

module.exports = {
  createCampaign, listPublicCampaigns, listAllCampaigns, listMyCampaigns,
  getCampaignById, verifyCampaign, addAmount, VERIFICATION_STATUSES, STATUSES,
  donateToCampaign, createPaymentOrder, razorpayWebhook,
};
