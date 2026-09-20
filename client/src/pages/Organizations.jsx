import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/organizations")
      .then(({ data }) => setOrgs(data.organizations))
      .catch(() => setError("Could not load organizations."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="directory-page organizations-page">
      <PublicPageHeader eyebrow="Trusted response network" title="Verified Organizations" accentWord="Organizations" description="Every organization listed here has been reviewed and verified by a DisasterShield admin." icon="building" action={<Link to="/organizations/register" className="btn btn-awareness">Register your organization</Link>} />

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : orgs.length === 0 ? (
        <p className="directory-empty">No verified organizations yet.</p>
      ) : (
        <div className="organization-grid">
          {orgs.map((o) => (
            <article key={o.id} className="organization-card">
              <div className="organization-card-heading">
                <div className="organization-identity">
                  <span className="organization-logo" aria-hidden="true">{o.name?.charAt(0)?.toUpperCase() || "O"}</span>
                  <div><h2>{o.name}</h2><span className="organization-type">{o.type}</span></div>
                </div>
                <span className="badge badge-relief">✓ Verified</span>
              </div>
              {o.website && <a className="organization-website" href={o.website.startsWith("http") ? o.website : `https://${o.website}`} target="_blank" rel="noreferrer">Website →</a>}
              {o.description && <p className="organization-description">{o.description}</p>}
              {o.operating_areas && <div className="organization-areas">Operates in: {o.operating_areas}</div>}
              {o.assistance_categories?.length > 0 && (
                <div className="organization-tags">
                  {o.assistance_categories.map((c) => (
                    <span key={c} className="badge badge-awareness">{c}</span>
                  ))}
                </div>
              )}
              <div className="organization-actions">
                <Link to={`/organizations/${o.id}/contact`} className="btn btn-relief">Contact Organization</Link>
                <Link to={`/organizations/${o.id}`} className="btn btn-outline-ink">View profile</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
