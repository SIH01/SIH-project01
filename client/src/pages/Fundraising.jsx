import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function CampaignCard({ campaign, organizationName }) {
  const percentage = Math.min(100, Math.round((Number(campaign.amount_raised) / Number(campaign.target_amount)) * 100));
  return (
    <Link to={`/fundraising/${campaign.id}`} className="fundraising-card-link">
      <article className="fundraising-card">
        <span className="badge badge-awareness">{campaign.status}</span>
        <h2>{campaign.title}</h2>
        <p className="fundraising-byline">by {organizationName || "Verified organization"}</p>
        <p>{campaign.description}</p>
        <div className="fundraising-progress" aria-label={`${percentage}% funded`}><span style={{ width: `${percentage}%` }} /></div>
        <strong>{formatMoney(campaign.amount_raised)} raised of {formatMoney(campaign.target_amount)} ({percentage}%)</strong>
      </article>
    </Link>
  );
}

function ShareButton() {
  const [message, setMessage] = useState("");
  const share = async () => {
    const shareData = { title: document.title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); setMessage("Link copied"); }
    } catch (error) {
      if (error.name !== "AbortError") setMessage("Could not share this link");
    }
  };
  return <button type="button" className="btn btn-outline-ink" onClick={share}>↗ Share {message && <span className="share-feedback">{message}</span>}</button>;
}

function CampaignDetail({ campaignId }) {
  const [campaign, setCampaign] = useState(null);
  const [donations, setDonations] = useState([]);
  const [organizationName, setOrganizationName] = useState("Verified organization");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ donorName: "", amount: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCampaign = async () => {
    const { data } = await api.get(`/campaigns/${campaignId}`);
    setError("");
    setCampaign(data.campaign);
    setDonations(data.donations || []);
    try {
      const organization = await api.get(`/organizations/${data.campaign.organization_id}`);
      setOrganizationName(organization.data.organization.name);
    } catch { /* The campaign remains usable if the public profile is unavailable. */ }
  };

  useEffect(() => {
    loadCampaign().catch(() => setError("Could not load this campaign."));
    const timer = window.setInterval(() => loadCampaign().catch(() => {}), 10000);
    return () => window.clearInterval(timer);
  }, [campaignId]);

  if (!campaign) return <div className="admin-page"><p>{error || "Loading campaign…"}</p></div>;

  const raised = Number(campaign.amount_raised);
  const goal = Number(campaign.target_amount);
  const percentage = Math.min(100, Math.round((raised / goal) * 100));
  const fullyFunded = raised >= goal;

  const submitDonation = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a donation amount greater than zero."); return; }
    try {
      const { data } = await api.post(`/campaigns/${campaignId}/payment-order`, form);
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "DisasterShield",
        description: `Donation for ${campaign.title}`,
        order_id: data.orderId,
        prefill: { name: form.donorName },
        handler: () => {
          setShowForm(false);
          setForm({ donorName: "", amount: "" });
          setNotice("Payment received. Your donor entry will appear after Razorpay confirms it.");
        },
        modal: { ondismiss: () => setNotice("Payment was cancelled. No donation was recorded.") },
      });
      checkout.open();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not record this donation.");
      if (requestError.response?.data?.campaign) setCampaign(requestError.response.data.campaign);
    }
  };

  return (
    <div className="admin-page fundraising-detail-page">
      <Link to="/fundraising" className="back-link">← All campaigns</Link>
      <article className="fundraising-detail-card">
        <div className="fundraising-detail-topline"><span className="badge badge-awareness">{fullyFunded ? "Fully funded" : "Active"}</span><ShareButton /></div>
        <h1>{campaign.title}</h1>
        <p className="fundraising-byline">by {organizationName}</p>
        <p className="fundraising-description">{campaign.description}</p>
        <div className="fundraising-amount-row"><strong>{formatMoney(raised)}</strong><span>of {formatMoney(goal)} goal</span></div>
        <div className="fundraising-progress fundraising-progress-large" aria-label={`${percentage}% funded`}><span style={{ width: `${percentage}%` }} /></div>
        <div className="fundraising-percent">{percentage}% funded</div>
        {notice && <div className="fundraising-notice">{notice}</div>}
        {error && <div className="error-banner">{error}</div>}
        {!fullyFunded && !showForm && <button type="button" className="btn btn-relief fundraising-donate-button" onClick={() => setShowForm(true)}>Donate</button>}
        {fullyFunded && <p className="fundraising-funded-copy">This campaign has reached its goal. Donations are closed.</p>}
        {showForm && !fullyFunded && (
          <form className="fundraising-form" onSubmit={submitDonation}>
            <div className="field"><label htmlFor="donorName">Your name <span>(optional)</span></label><input id="donorName" value={form.donorName} onChange={(event) => setForm({ ...form, donorName: event.target.value })} maxLength="80" placeholder="Shown to other supporters" /></div>
            <div className="field"><label htmlFor="donationAmount">Donation amount</label><input id="donationAmount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></div>
            <div className="fundraising-form-actions"><button type="submit" className="btn btn-relief">Simulate donation</button><button type="button" className="btn btn-outline-ink" onClick={() => setShowForm(false)}>Cancel</button></div>
            <small>Payments are processed by Razorpay. Your name and donation appear only after Razorpay confirms payment.</small>
          </form>
        )}
        <section className="recent-donors"><h2>Recent donors</h2>{donations.length === 0 ? <p>No donors yet. Be the first to support this campaign.</p> : <ul>{donations.map((donation) => <li key={donation.id}><span>{donation.donor_name || "Anonymous supporter"}</span><strong>{formatMoney(donation.amount)}</strong></li>)}</ul>}</section>
      </article>
    </div>
  );
}

export default function Fundraising() {
  const { campaignId } = useParams();
  const [campaigns, setCampaigns] = useState([]);
  const [orgNames, setOrgNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (campaignId) return;
    api.get("/campaigns").then(async ({ data }) => {
      const list = data.campaigns || [];
      setCampaigns(list);
      const entries = await Promise.all(list.map(async (campaign) => {
        try { const response = await api.get(`/organizations/${campaign.organization_id}`); return [campaign.organization_id, response.data.organization.name]; }
        catch { return [campaign.organization_id, "Verified organization"]; }
      }));
      setOrgNames(Object.fromEntries(entries));
    }).catch(() => setError("Could not load campaigns.")).finally(() => setLoading(false));
  }, [campaignId]);

  if (campaignId) return <CampaignDetail campaignId={campaignId} />;
  return (
    <div className="admin-page fundraising-list-page">
      <PublicPageHeader eyebrow="Community fundraising" title="Fundraising Campaigns" accentWord="Campaigns" description="Support verified response work. Contributions on this prototype are simulated and securely recorded for everyone viewing the campaign." icon="megaphone" />
      {error && <div className="error-banner">{error}</div>}
      {loading ? <p>Loading…</p> : campaigns.length === 0 ? <p className="fundraising-empty">No active campaigns right now.</p> : <div className="fundraising-grid">{campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} organizationName={orgNames[campaign.organization_id]} />)}</div>}
    </div>
  );
}
