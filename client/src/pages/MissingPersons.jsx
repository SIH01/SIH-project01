import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

function formatDate(value) {
  if (!value) return "Date not provided";
  return new Date(value).toLocaleDateString();
}

function daysMissing(value) {
  if (!value) return null;
  const seen = new Date(`${value}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const difference = Math.floor((todayUtc - seen.getTime()) / 86400000);
  return Number.isFinite(difference) ? Math.max(0, difference) : null;
}

function statusDetails(value) {
  const status = value?.toLowerCase() || "reported";
  if (status.includes("found") || status.includes("resolved") || status.includes("closed")) {
    return { label: "FOUND / RESOLVED", tone: "resolved" };
  }
  if (status.includes("investigat") || status.includes("search")) {
    return { label: "INVESTIGATING", tone: "investigating" };
  }
  return { label: "REPORTED", tone: "reported" };
}

function informationTags(value) {
  if (!value) return [];
  return value
    .replace(/^he is\s+/i, "")
    .replace(/[.!?]+$/, "")
    .split(/\s+and\s+/i)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));
}

export default function MissingPersons() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/missing-persons/public")
      .then(({ data }) => setReports(data.reports || []))
      .catch(() => setError("Could not load missing people."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="directory-page missing-people-page">
      <PublicPageHeader className="missing-registry-header" eyebrow="Community safety" title="Missing Persons Registry" accentWord="Registry" description="Browse active missing-person reports from affected areas. If you have information, please contact local authorities immediately." icon="shield" />
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">⌕</div>
          <h2>No active reports</h2>
          <p>There are no publicly listed missing-person reports right now.</p>
        </div>
      ) : (
        <div className="missing-people-list">
          {reports.map((report) => (
            (() => {
              const status = statusDetails(report.status);
              const missingDays = daysMissing(report.date_last_seen);
              const tags = informationTags(report.description);
              return <article key={report.id} className="missing-person-card">
              <div className="missing-person-photo-wrap">
                {report.photo_url ? <img className="missing-person-photo" src={report.photo_url} alt={`Photo of ${report.person_name}`} /> : <div className="missing-person-photo missing-person-photo-placeholder" aria-hidden="true">⌕</div>}
              </div>
              <div className="missing-person-content">
                <div className="missing-person-card-heading"><div><p className="eyebrow">Missing person</p><h2>{report.person_name}</h2></div><div className="missing-person-status-group">{missingDays != null && <span className="missing-urgency-badge">{missingDays} {missingDays === 1 ? "DAY" : "DAYS"} MISSING</span>}<span className={`badge missing-status missing-status-${status.tone}`}>{status.label}</span></div></div>
                <div className="missing-person-facts">
                  {report.age != null && <span><small>Age</small><strong>{report.age}</strong></span>}
                  <span><small>Last seen</small><strong>{formatDate(report.date_last_seen)}</strong></span>
                  <span><small>Location</small><strong>{report.last_known_location}</strong></span>
                </div>
                {tags.length > 0 && <div className="missing-person-information"><strong>Important information</strong><div className="missing-person-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>}
                {report.additional_information && <p className="missing-person-additional">{report.additional_information}</p>}
                <div className="missing-person-actions">
                  <a className="missing-person-primary-action" href="/get-help">I HAVE INFORMATION <span aria-hidden="true">→</span></a>
                  <a className="missing-person-secondary-action" href="/get-help">Contact local authorities</a>
                </div>
              </div>
              </article>;
            })()
          ))}
        </div>
      )}
    </main>
  );
}