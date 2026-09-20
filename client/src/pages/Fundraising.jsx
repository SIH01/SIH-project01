import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

export default function Fundraising() {
  const [campaigns, setCampaigns] = useState([]);
  const [orgNames, setOrgNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/campaigns")
      .then(async ({ data }) => {
        const list = data.campaigns || [];
        setCampaigns(list);
        const uniqueOrgIds = [...new Set(list.map((c) => c.organization_id))];
        const entries = await Promise.all(
          uniqueOrgIds.map(async (id) => {
            try {
              const res = await api.get(`/organizations/${id}`);
              return [id, res.data.organization.name];
            } catch {
              return [id, "Verified organization"];
            }
          })
        );
        setOrgNames(Object.fromEntries(entries));
      })
      .catch(() => setError("Could not load campaigns."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-page">
      <PublicPageHeader eyebrow="Community fundraising" title="Fundraising Campaigns" accentWord="Campaigns" description="Every campaign shown here has been reviewed and verified by an administrator. This prototype does not process real payments — contact the organization directly to contribute." icon="megaphone" />
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : campaigns.length === 0 ? (
        <p style={{ color: "#5c6673" }}>No active campaigns right now.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {campaigns.map((c) => {
            const pct = Math.min(100, Math.round((c.amount_raised / c.target_amount) * 100));
            return (
              <div key={c.id} className="dashboard-card">
                <span className="badge badge-awareness">{c.status}</span>
                <h2 style={{ margin: "0.6rem 0 0.3rem" }}>{c.title}</h2>
                <p style={{ fontSize: "0.85rem", color: "#5c6673", marginBottom: "0.5rem" }}>by {orgNames[c.organization_id] || "…"}</p>
                <p style={{ fontSize: "0.9rem" }}>{c.description}</p>
                <div style={{ margin: "0.9rem 0 0.4rem", height: "8px", borderRadius: "999px", background: "rgba(16,27,45,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "var(--relief)" }} />
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  ₹{Number(c.amount_raised).toLocaleString("en-IN")} raised of ₹{Number(c.target_amount).toLocaleString("en-IN")} ({pct}%)
                </div>
                {c.location_name && <p style={{ fontSize: "0.8rem", color: "#8892a0", marginTop: "0.4rem" }}>{c.location_name}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}