const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { findByEmail } = require("../models/userStore");
const {
  getVerified, getAll, getPending, getById, getByUserId, updateByUserId, create, setVerificationStatus, remove,
} = require("../models/organizationModel");
const { logAdminAction } = require("../utils/auditLog");
const { notify } = require("../utils/notify");

const JWT_SECRET = process.env.JWT_SECRET;
const ORG_TYPES = [
  "NGO", "Charity", "Volunteer Group", "Food Distribution", "Medical",
  "Shelter Provider", "Search and Rescue", "Mental Health", "Other",
];
const ASSISTANCE_CATEGORIES = [
  "Food", "Water", "Medical", "Shelter", "Missing-person assistance",
  "Financial assistance", "Mental-health support", "Search and rescue",
  "Essential supplies", "Other",
];
const VERIFICATION_STATUSES = ["Pending", "Under Review", "Verified", "Rejected", "Suspended"];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicOrgUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function validateRegistration(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push("Organization name is required.");
  if (!ORG_TYPES.includes(body.type)) errors.push("Organization type must be one of: " + ORG_TYPES.join(", "));
  if (!body.email || !isValidEmail(body.email)) errors.push("A valid organization email is required.");
  if (!body.password || body.password.length < 8) errors.push("Password must be at least 8 characters.");
  if (!body.representative_name || !body.representative_name.trim()) errors.push("Authorized representative name is required.");
  if (!body.representative_contact || !body.representative_contact.trim()) errors.push("Representative contact is required.");
  if (!Array.isArray(body.assistance_categories) || body.assistance_categories.length === 0) {
    errors.push("Select at least one assistance category.");
  } else if (body.assistance_categories.some((c) => !ASSISTANCE_CATEGORIES.includes(c))) {
    errors.push("Assistance categories must be one of: " + ASSISTANCE_CATEGORIES.join(", "));
  }
  return errors;
}

// POST /api/organizations/register — public. Creates a login (role
// 'organization') AND the profile admins review, in one transaction.
// The account can log in immediately but stays unverified (Pending) until
// an admin approves it — see requireVerifiedOrg-style checks in campaign
// and response controllers.
async function register(req, res) {
  const body = req.body;
  const errors = validateRegistration(body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const client = await pool.connect();
  try {
    if (await findByEmail(body.email)) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    await client.query("BEGIN");
    const passwordHash = await bcrypt.hash(body.password, 10);
    const userResult = await client.query(
      `insert into users (name, email, password_hash, role)
       values ($1, $2, $3, 'organization') returning id, name, email, role, created_at`,
      [body.name, body.email, passwordHash]
    );
    const user = userResult.rows[0];

    const orgResult = await client.query(
      `insert into organizations
        (user_id, name, type, description, website, email, phone, address,
         operating_areas, latitude, longitude, assistance_categories,
         documents, representative_name, representative_contact)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning id, verification_status`,
      [
        user.id, body.name, body.type, body.description || null, body.website || null,
        body.email, body.phone || null, body.address || null, body.operating_areas || null,
        body.latitude != null ? parseFloat(body.latitude) : null,
        body.longitude != null ? parseFloat(body.longitude) : null,
        body.assistance_categories, body.documents || null,
        body.representative_name, body.representative_contact,
      ]
    );

    await client.query("COMMIT");

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "8h" });
    res.status(201).json({
      token,
      user: publicOrgUser(user),
      organization: { id: orgResult.rows[0].id, verification_status: orgResult.rows[0].verification_status },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("organization register error:", err.message);
    res.status(500).json({ error: "Could not register organization. Please try again." });
  } finally {
    client.release();
  }
}

// GET /api/organizations — public directory, verified only.
async function listVerified(req, res) {
  try {
    const organizations = await getVerified();
    res.json({ organizations });
  } catch (err) {
    console.error("listVerified error:", err.message);
    res.status(500).json({ error: "Could not load organizations." });
  }
}

// GET /api/organizations/admin/all — admin only, every status.
async function listAll(req, res) {
  try {
    const organizations = await getAll();
    res.json({ organizations });
  } catch (err) {
    console.error("listAll error:", err.message);
    res.status(500).json({ error: "Could not load organizations." });
  }
}

// GET /api/organizations/pending — admin-only verification queue.
async function listPending(req, res) {
  try {
    const organizations = await getPending();
    res.json({ organizations });
  } catch (err) {
    console.error("listPending organizations error:", err.message);
    res.status(500).json({ error: "Could not load pending organizations." });
  }
}

// GET /api/organizations/me — the logged-in organization's own profile.
async function getMyOrganization(req, res) {
  try {
    const organization = await getByUserId(req.user.id);
    if (!organization) return res.status(404).json({ error: "Organization profile not found." });
    res.json({ organization });
  } catch (err) {
    console.error("getMyOrganization error:", err.message);
    res.status(500).json({ error: "Could not load organization profile." });
  }
}

// PATCH /api/organizations/me — organization-owned profile fields only.
async function updateMyOrganization(req, res) {
  const allowedTypes = ORG_TYPES;
  const { name, type, description, email, razorpay_account_id, phone, address, operating_areas, latitude, longitude, assistance_categories } = req.body || {};
  if (type && !allowedTypes.includes(type)) return res.status(400).json({ error: "Invalid organization type." });
  if (assistance_categories && (!Array.isArray(assistance_categories) || assistance_categories.some((item) => !ASSISTANCE_CATEGORIES.includes(item)))) {
    return res.status(400).json({ error: "Invalid assistance category." });
  }
  const parsedLatitude = latitude === "" || latitude == null ? null : parseFloat(latitude);
  const parsedLongitude = longitude === "" || longitude == null ? null : parseFloat(longitude);
  if ((parsedLatitude != null && (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90)) ||
      (parsedLongitude != null && (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180))) {
    return res.status(400).json({ error: "Coordinates must be valid latitude and longitude values." });
  }
  try {
    const organization = await updateByUserId(req.user.id, {
      name: name?.trim(), type, description, email: email?.trim(), razorpay_account_id: razorpay_account_id?.trim(), phone, address, operating_areas,
      latitude: parsedLatitude, longitude: parsedLongitude, assistance_categories,
    });
    if (!organization) return res.status(404).json({ error: "Organization profile not found." });
    res.json({ organization });
  } catch (err) {
    console.error("updateMyOrganization error:", err.message);
    res.status(500).json({ error: "Could not update organization profile." });
  }
}

// GET /api/organizations/:id — public, single org (used on the directory detail view).
async function getOrganizationById(req, res) {
  try {
    const organization = await getById(req.params.id);
    if (!organization) return res.status(404).json({ error: "Organization not found." });
    res.json({ organization });
  } catch (err) {
    console.error("getOrganizationById error:", err.message);
    res.status(500).json({ error: "Could not load organization." });
  }
}

// PUT /api/organizations/:id/verify — admin only. Approve / reject / suspend / reactivate.
async function verifyOrganization(req, res) {
  const verification_status = req.body.verification_status ||
    (req.body.status === "approved" ? "Verified" : req.body.status === "rejected" ? "Rejected" : req.body.status);
  if (!VERIFICATION_STATUSES.includes(verification_status)) {
    return res.status(400).json({ error: "Status must be one of: " + VERIFICATION_STATUSES.join(", ") });
  }
  try {
    const organization = await setVerificationStatus(req.params.id, verification_status);
    if (!organization) return res.status(404).json({ error: "Organization not found." });

    await logAdminAction(req.user.id, `organization.${verification_status.toLowerCase()}`, "organization", organization.id, null);
    if (organization.user_id) {
      await notify(
        organization.user_id,
        "Organization verification update",
        `Your organization "${organization.name}" is now: ${verification_status}.`
      );
    }
    res.json({ organization });
  } catch (err) {
    console.error("verifyOrganization error:", err.message);
    res.status(500).json({ error: "Could not update verification status." });
  }
}

// DELETE /api/organizations/:id — admin only. Permanently removes the
// organization (and its login account). Their shelters, responses, and
// campaigns go with it; any help/relief requests they'd claimed are simply
// unclaimed rather than deleted.
async function deleteOrganization(req, res) {
  try {
    const deleted = await remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Organization not found." });

    await logAdminAction(req.user.id, "organization.delete", "organization", deleted.id, deleted.name);
    res.json({ success: true, organization: { id: deleted.id, name: deleted.name } });
  } catch (err) {
    console.error("deleteOrganization error:", err.message);
    res.status(500).json({ error: "Could not delete organization." });
  }
}

module.exports = {
  register, listVerified, listAll, listPending, getMyOrganization, updateMyOrganization, getOrganizationById, verifyOrganization,
  deleteOrganization,
  ORG_TYPES, ASSISTANCE_CATEGORIES, VERIFICATION_STATUSES,
};
