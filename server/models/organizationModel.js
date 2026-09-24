const pool = require("../db/pool");

const SELECT_FIELDS = `
  id, user_id, name, type, description, website, email, phone, address,
  operating_areas, latitude, longitude, assistance_categories,
  verification_status, documents, representative_name, representative_contact, razorpay_account_id,
  created_at, verified_at
`;

// Public directory — verified organizations only.
async function getVerified() {
  const { rows } = await pool.query(
    `select ${SELECT_FIELDS} from organizations where verification_status = 'Verified' order by name`
  );
  return rows;
}

// Admin queue — every organization regardless of status.
async function getAll() {
  const { rows } = await pool.query(`select ${SELECT_FIELDS} from organizations order by created_at desc`);
  return rows;
}

async function getPending() {
  const { rows } = await pool.query(
    `select ${SELECT_FIELDS} from organizations
     where verification_status in ('Pending', 'Under Review') order by created_at desc`
  );
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query(`select ${SELECT_FIELDS} from organizations where id = $1`, [id]);
  return rows[0] || null;
}

async function getByUserId(userId) {
  const { rows } = await pool.query(`select ${SELECT_FIELDS} from organizations where user_id = $1`, [userId]);
  return rows[0] || null;
}

async function updateByUserId(userId, data) {
  const { rows } = await pool.query(
    `update organizations set
       name = coalesce($1, name),
       type = coalesce($2, type),
       description = coalesce($3, description),
       email = coalesce($4, email),
       razorpay_account_id = coalesce($5, razorpay_account_id),
       phone = coalesce($6, phone),
       address = coalesce($7, address),
       operating_areas = coalesce($8, operating_areas),
       latitude = coalesce($9, latitude),
       longitude = coalesce($10, longitude),
       assistance_categories = coalesce($11, assistance_categories)
     where user_id = $12
     returning ${SELECT_FIELDS}`,
    [data.name || null, data.type || null, data.description ?? null, data.email ?? null, data.razorpay_account_id ?? null, data.phone ?? null,
      data.address ?? null, data.operating_areas ?? null, data.latitude ?? null,
      data.longitude ?? null, data.assistance_categories || null, userId]
  );
  return rows[0] || null;
}

async function create(data) {
  const {
    userId, name, type, description, website, email, phone, address,
    operating_areas, latitude, longitude, assistance_categories,
    documents, representative_name, representative_contact,
  } = data;
  const { rows } = await pool.query(
    `insert into organizations
      (user_id, name, type, description, website, email, phone, address,
       operating_areas, latitude, longitude, assistance_categories,
       documents, representative_name, representative_contact)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     returning ${SELECT_FIELDS}`,
    [userId, name, type, description || null, website || null, email, phone || null, address || null,
     operating_areas || null, latitude ?? null, longitude ?? null, assistance_categories || [],
     documents || null, representative_name || null, representative_contact || null]
  );
  return rows[0];
}

// Admin-only status transition. Sets verified_at the moment it becomes Verified.
async function setVerificationStatus(id, status) {
  const { rows } = await pool.query(
    `update organizations set
       verification_status = $1,
       verified_at = case when $1 = 'Verified' then now() else verified_at end
     where id = $2
     returning ${SELECT_FIELDS}`,
    [status, id]
  );
  return rows[0] || null;
}

// Admin-only hard delete. Removes the organization profile row (shelters,
// organization_responses, and campaigns cascade-delete via their FKs; any
// help/relief requests it claimed are set back to unclaimed) and, in the
// same transaction, the linked login account so it can no longer sign in.
// Returns the deleted profile's { id, name, user_id } or null if it
// didn't exist.
async function remove(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `delete from organizations where id = $1 returning id, name, user_id`,
      [id]
    );
    const deleted = rows[0];
    if (!deleted) {
      await client.query("ROLLBACK");
      return null;
    }
    if (deleted.user_id) {
      await client.query(`delete from users where id = $1`, [deleted.user_id]);
    }
    await client.query("COMMIT");
    return deleted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getVerified, getAll, getPending, getById, getByUserId, updateByUserId, create, setVerificationStatus, remove };
