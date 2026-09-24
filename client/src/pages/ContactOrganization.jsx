import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import "./contactPortal.css";

const CATEGORIES = ["Food", "Water", "Medical", "Shelter", "Rescue", "Other"];
const URGENCIES = ["Low", "Medium", "High", "Critical"];

export default function ContactOrganization() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [form, setForm] = useState({ requester_name: user?.name || "", phone: "", email: user?.email || "", location: "", category: "", urgency: "Medium", message: "", attachment_url: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get(`/organizations/${id}`).then(({ data }) => setOrganization(data.organization)).catch(() => setError("This organization could not be found.")); }, [id]);
  useEffect(() => { if (user) setForm((current) => ({ ...current, requester_name: current.requester_name || user.name, email: current.email || user.email })); }, [user]);

  const categories = organization?.assistance_categories?.filter((category) => CATEGORIES.includes(category)) || CATEGORIES;
  function update(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit(event) {
    event.preventDefault(); setError(""); setSaving(true);
    try { const { data } = await api.post("/contact-threads", { ...form, organization_id: id }); setResult(data); } catch (err) { setError(err.response?.data?.error || "Could not send your request."); } finally { setSaving(false); }
  }

  if (result) return <main className="contact-page"><section className="confirmation-panel"><span className="confirmation-mark">✓</span><p className="eyebrow">Request received</p><h1>Your message is with {organization?.name || "the organization"}.</h1><p>Keep this tracking ID somewhere safe. You can use it to follow the conversation without creating an account.</p><div className="tracking-code">{result.tracking_id}</div><div className="contact-actions"><Link className="btn btn-awareness" to={`/messages/${result.request.id}?tracking_id=${result.tracking_id}`}>Open chat</Link><Link className="btn btn-outline-ink" to="/organizations">Return to directory</Link></div></section></main>;
  return <main className="contact-page"><div className="contact-header"><Link to="/organizations" className="back-link">← Verified organizations</Link><p className="eyebrow">Direct support channel</p><h1>Contact {organization?.name || "organization"}</h1><p>Tell a verified relief team what is happening. They will see your request in their secure response inbox.</p></div><section className="contact-layout"><form className="contact-form" onSubmit={submit}><div className="form-section"><h2>How can they reach you?</h2><div className="form-grid"><label className="field"><span>Name</span><input value={form.requester_name} onChange={(e) => update("requester_name", e.target.value)} required /></label><label className="field"><span>Phone</span><input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="For urgent follow-up" /></label><label className="field"><span>Email <small>optional</small></span><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></label><label className="field"><span>Location or address <small>optional</small></span><input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Neighborhood, landmark, or pin" /></label></div></div><div className="form-section"><h2>What do you need?</h2><div className="form-grid"><label className="field"><span>Category</span><select value={form.category} onChange={(e) => update("category", e.target.value)} required><option value="">Select a service</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="field"><span>Urgency</span><select value={form.urgency} onChange={(e) => update("urgency", e.target.value)}>{URGENCIES.map((urgency) => <option key={urgency}>{urgency}</option>)}</select></label></div><label className="field"><span>Message</span><textarea rows="6" value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Describe what is needed, who is affected, and any useful details." required /></label><label className="field"><span>Photo or document link <small>optional</small></span><input value={form.attachment_url} onChange={(e) => update("attachment_url", e.target.value)} placeholder="Paste a secure link if you have one" /></label></div>{error && <div className="error-banner">{error}</div>}<button className="btn btn-relief contact-submit" disabled={saving}>{saving ? "Sending request…" : "Send help request"}</button></form><aside className="contact-aside"><span className="aside-icon">◌</span><h2>What happens next?</h2><ol><li>Your request gets a private tracking ID.</li><li>The verified organization sees it in their inbox.</li><li>You can continue the conversation and follow status changes.</li></ol><p className="dashboard-muted">For immediate danger, contact local emergency services first.</p></aside></section></main>;
}
