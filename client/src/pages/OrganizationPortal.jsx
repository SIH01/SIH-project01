import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import "./contactPortal.css";

const pages = [
  ["overview", "Overview", "⌂"],
  ["queue", "Response queue", "↗"],
  ["cases", "Case management", "◇"],
  ["campaigns", "Campaign review", "◫"],
  ["profile", "Organization profile", "◎"],
];
const statusLabels = { new: "New", in_review: "Under review", in_progress: "Active", resolved: "Closed" };
const EMPTY_CAMPAIGN = { title: "", description: "", target_amount: "", purpose: "", location_name: "" };

function Toast({ message }) { return message ? <div className="org-toast" role="status">✓ {message}</div> : null; }
function PageHeading({ eyebrow, title, description }) { return <div className="workspace-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>; }
function StatCard({ label, value, detail, tone }) { return <article className={`workspace-stat ${tone || ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }

export default function OrganizationPortal() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [page, setPage] = useState("overview");
  const [organization, setOrganization] = useState(null);
  const [requests, setRequests] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  async function load() {
    try {
      const [orgResult, requestResult, campaignResult, reportResult] = await Promise.all([
        api.get("/organizations/me"), api.get("/org/requests"), api.get("/campaigns/mine"), api.get("/org/missing-persons"),
      ]);
      setOrganization(orgResult.data.organization);
      setProfile(orgResult.data.organization);
      setRequests(requestResult.data.requests || []);
      setCampaigns(campaignResult.data.campaigns || []);
      setReports(reportResult.data.reports || []);
      setError("");
    } catch (err) {
      const message = err.response?.status === 429
        ? "The organization dashboard is being rate-limited. Restart the backend or wait for the API limit to reset."
        : err.response?.data?.error || "Could not load the organization workspace.";
      setError(message);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { const timer = setInterval(load, 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(""), 3200); return () => clearTimeout(timer); }, [toast]);

  const pendingRequests = useMemo(() => requests.filter((item) => ["new", "in_review"].includes(item.status)), [requests]);
  const activeCampaigns = campaigns.filter((item) => item.status === "Active");
  const totalRaised = campaigns.reduce((sum, item) => sum + Number(item.amount_raised || 0), 0);

  async function selectRequest(request) {
    try { const { data } = await api.get(`/org/requests/${request.id}`); setSelectedRequest(data.request); }
    catch (err) { setError(err.response?.data?.error || "Could not open this request."); }
  }
  async function replyToRequest(request) {
    try {
      await api.post(`/org/requests/${request.id}/messages`, { body: "Hello, our response team is reviewing your request and will follow up shortly." });
      setRequests((current) => current.filter((item) => item.id !== request.id));
      setToast("Reply sent and request moved from the queue.");
    } catch (err) { setError(err.response?.data?.error || "Could not send the reply."); }
  }
  async function saveProfile(event) {
    event.preventDefault();
    try { const { data } = await api.patch("/organizations/me", profile); setOrganization(data.organization); setProfile(data.organization); setToast("Organization profile saved."); }
    catch (err) { setError(err.response?.data?.error || "Could not save the profile."); }
  }
  function localCampaignDecision(id, decision) {
    setCampaigns((current) => current.map((item) => item.id === id ? { ...item, prototypeDecision: decision } : item));
    setToast(`Campaign ${decision.toLowerCase()} in this prototype view.`);
  }
  function signOut() { logout(); navigate("/org/login"); }
  async function createCampaign(event) {
    event.preventDefault();
    setCreatingCampaign(true); setError("");
    try {
      await api.post("/campaigns", campaignForm);
      setCampaignForm(EMPTY_CAMPAIGN);
      await load();
      setToast("Campaign submitted for administrator review.");
    } catch (err) { setError(err.response?.data?.error || "Could not create campaign."); }
    finally { setCreatingCampaign(false); }
  }

  const orgName = organization?.name || user?.name || "Organization";
  const renderOverview = () => <>
    <PageHeading eyebrow="Workspace overview" title="Good morning, team" description="A clear view of the work that needs your attention today." />
    <div className="workspace-stats"><StatCard label="Active campaigns" value={activeCampaigns.length} detail="Currently visible publicly" tone="blue" /><StatCard label="Total raised" value={`₹${totalRaised.toLocaleString("en-IN")}`} detail="Across your campaigns" tone="green" /><StatCard label="Pending responses" value={pendingRequests.length} detail="Need a first reply" tone="orange" /><StatCard label="Cases under review" value={reports.filter((item) => item.status !== "resolved").length} detail="Missing-person cases" tone="slate" /></div>
    <div className="workspace-columns"><section className="workspace-card"><div className="card-heading"><div><p className="eyebrow">Latest activity</p><h3>Recent activity</h3></div><button type="button" className="text-action" onClick={() => setPage("queue")}>View queue →</button></div><div className="activity-list"><div><span className="activity-icon blue">↗</span><p><strong>{pendingRequests.length} requests</strong> are waiting for a response<small>Updated from the response queue</small></p></div><div><span className="activity-icon green">₹</span><p><strong>₹{totalRaised.toLocaleString("en-IN")}</strong> raised across active campaigns<small>Campaign ledger snapshot</small></p></div><div><span className="activity-icon orange">◇</span><p><strong>{reports.length} cases</strong> are in your operating area<small>Missing-person coordination</small></p></div></div></section><section className="workspace-card workspace-callout"><p className="eyebrow">Response desk</p><h3>Keep the queue moving</h3><p>Reply quickly to new requests and keep your campaign details current so people know where support is available.</p><button type="button" className="btn btn-relief" onClick={() => setPage("queue")}>Open response queue</button></section></div>
  </>;
  const renderQueue = () => <><PageHeading eyebrow="Incoming support" title="Response queue" description="Help-seeker messages waiting for an initial response." /><section className="workspace-card"><div className="queue-toolbar"><span>{pendingRequests.length} pending</span><select aria-label="Queue filter"><option>All requests</option><option>Critical first</option></select></div>{pendingRequests.length === 0 ? <div className="workspace-empty"><strong>Queue is clear</strong><span>New help-seeker requests will appear here.</span></div> : <div className="queue-list">{pendingRequests.map((request) => <article className="queue-row" key={request.id}><div className="queue-avatar">{String(request.name || "H").slice(0, 1).toUpperCase()}</div><div className="queue-copy"><div><strong>{request.name || "Help seeker"}</strong><span className={`status-pill status-${request.status}`}>{statusLabels[request.status] || request.status}</span></div><p>{request.description || request.message || "A help request needs your attention."}</p><small>{request.type || request.category || "General assistance"} · {request.location_text || "Location not provided"}</small></div><div className="queue-actions"><button type="button" className="btn btn-relief compact-button" onClick={() => replyToRequest(request)}>Reply</button><button type="button" className="text-action" onClick={() => selectRequest(request)}>View</button></div></article>)}</div>}</section></>;
  const renderCases = () => <><PageHeading eyebrow="Ongoing work" title="Case management" description="Track missing-person cases and the next action for each one." /><section className="workspace-card"><div className="table-wrap"><table className="workspace-table"><thead><tr><th>Case</th><th>Last known location</th><th>Updated</th><th>Status</th><th /></tr></thead><tbody>{reports.length === 0 ? <tr><td colSpan="5" className="table-empty">No cases in your operating area.</td></tr> : reports.map((report) => <tr key={report.id}><td><strong>{report.person_name || "Unnamed case"}</strong><small>Case #{report.id}</small></td><td>{report.last_known_location || "Not provided"}</td><td>{report.updated_at ? new Date(report.updated_at).toLocaleDateString() : "Today"}</td><td><span className={`status-pill status-${report.status === "resolved" ? "approved" : report.status === "under_review" ? "pending" : "in-progress"}`}>{report.status === "resolved" ? "Closed" : report.status === "under_review" ? "Under review" : "Active"}</span></td><td><button type="button" className="text-action" onClick={() => setToast("Case details opened in the full portal.")}>Open →</button></td></tr>)}</tbody></table></div></section></>;
  const renderCampaigns = () => <><PageHeading eyebrow="Fundraising operations" title="Campaign review" description="Create campaigns that help people understand your need and donate directly to your organization." /><section className="workspace-card"><form className="campaign-create-form" onSubmit={createCampaign}><div className="campaign-launch-panel"><div><span className="eyebrow">Raise funds</span><h3>Start a new fundraising campaign</h3><p>Campaigns are reviewed by an administrator before they appear publicly. Donors pay through Razorpay and confirmed funds are routed to your linked organization account.</p></div><button type="submit" className="btn btn-relief" disabled={creatingCampaign}>{creatingCampaign ? "Submitting…" : "Submit campaign"}</button></div><div className="campaign-form-grid"><label className="field"><span>Campaign title</span><input value={campaignForm.title} onChange={(event) => setCampaignForm({ ...campaignForm, title: event.target.value })} required /></label><label className="field"><span>Fundraising goal (₹)</span><input type="number" min="1" value={campaignForm.target_amount} onChange={(event) => setCampaignForm({ ...campaignForm, target_amount: event.target.value })} required /></label><label className="field campaign-form-wide"><span>What are you raising money for?</span><textarea rows="4" value={campaignForm.description} onChange={(event) => setCampaignForm({ ...campaignForm, description: event.target.value })} required /></label><label className="field"><span>Purpose <small>optional</small></span><input value={campaignForm.purpose} onChange={(event) => setCampaignForm({ ...campaignForm, purpose: event.target.value })} placeholder="Emergency food kits" /></label><label className="field"><span>Location <small>optional</small></span><input value={campaignForm.location_name} onChange={(event) => setCampaignForm({ ...campaignForm, location_name: event.target.value })} placeholder="District or community" /></label></div></form><div className="review-list">{campaigns.length === 0 ? <div className="workspace-empty"><strong>No campaigns yet</strong><span>Create your first campaign above.</span></div> : campaigns.map((campaign) => <article className="review-row" key={campaign.id}><div><span className="eyebrow">Campaign #{campaign.id}</span><h3>{campaign.title}</h3><p>{campaign.description || "No description provided."}</p></div><div className="review-meta"><span className={`status-pill ${campaign.status === "Active" ? "status-approved" : "status-pending"}`}>{campaign.status === "Active" ? "Live" : campaign.verification_status}</span><strong>₹{Number(campaign.amount_raised || 0).toLocaleString("en-IN")} / ₹{Number(campaign.target_amount || 0).toLocaleString("en-IN")}</strong>{campaign.status === "Active" && <button type="button" className="text-action" onClick={() => navigate(`/fundraising/${campaign.id}`)}>View public page →</button>}</div></article>)}</div></section></>;
  const renderProfile = () => profile && <><PageHeading eyebrow="Workspace settings" title="Organization profile" description="Keep the details responders and help-seekers rely on up to date." /><form className="workspace-card profile-form" onSubmit={saveProfile}><div className="profile-form-heading"><div className="profile-large-avatar">{orgName.slice(0, 1).toUpperCase()}</div><div><h3>{orgName}</h3><p>Verified organization profile</p></div></div><div className="profile-grid"><label className="field"><span>Organization name</span><input value={profile.name || ""} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label className="field"><span>Contact email</span><input type="email" value={profile.email || ""} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required /></label><label className="field"><span>Razorpay linked account ID</span><input value={profile.razorpay_account_id || ""} onChange={(event) => setProfile({ ...profile, razorpay_account_id: event.target.value })} placeholder="acc_..." /><small className="profile-field-help">Required before donors can pay your campaigns.</small></label><label className="field profile-wide"><span>About the organization</span><textarea rows="5" value={profile.description || ""} onChange={(event) => setProfile({ ...profile, description: event.target.value })} placeholder="Describe your response work" /></label></div><div className="profile-form-footer"><span className="profile-save-note">Campaign donations require a verified Razorpay linked account.</span><button type="submit" className="btn btn-relief">Save changes</button></div></form></>;

  return <main className="org-workspace-v2"><aside className="org-sidebar-v2"><div className="org-brand-v2"><span className="org-brand-mark-v2">✓</span><span>DisasterShield<small>Organization workspace</small></span></div><p className="sidebar-section-label">Workspace</p><nav className="org-nav-v2">{pages.map(([key, label, icon]) => <button type="button" key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}><span className="nav-icon">{icon}</span><span>{label}</span>{key === "queue" && pendingRequests.length > 0 && <b>{pendingRequests.length}</b>}</button>)}</nav><div className="sidebar-bottom"><button type="button" onClick={() => navigate("/organizations")}>↗ Public directory</button><button type="button" onClick={signOut}>↪ Sign out</button></div></aside><section className="org-main-v2"><header className="org-topbar-v2"><div><p className="topbar-kicker">Organization workspace</p><h1>{pages.find(([key]) => key === page)?.[1]}</h1></div><div className="topbar-account"><NotificationBell /><span className="topbar-org-name">{orgName}</span><span className="org-avatar-v2">{orgName.slice(0, 1).toUpperCase()}</span></div></header><div className="org-page-content-v2">{error && <div className="error-banner">{error}</div>}{organization?.verification_status !== "Verified" ? <section className="workspace-card verification-card"><span className="status-pill status-pending">Pending verification</span><h2>Your workspace is being reviewed</h2><p>Workspace actions will unlock after an administrator verifies your organization.</p></section> : page === "overview" ? renderOverview() : page === "queue" ? renderQueue() : page === "cases" ? renderCases() : page === "campaigns" ? renderCampaigns() : renderProfile()}</div></section><Toast message={toast} /></main>;
}
