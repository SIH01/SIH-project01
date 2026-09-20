import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import { api } from "../services/api";
import { colorForType } from "../utils/disasterOptions";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function severityClass(severity) {
  if (severity === "High" || severity === "Severe") return "detail-badge detail-badge-high";
  if (severity === "Moderate") return "detail-badge detail-badge-medium";
  return "detail-badge detail-badge-low";
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "Not specified";
}

export default function DisasterDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const [disaster, setDisaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareLabel, setShareLabel] = useState("Share this alert");
  const [shareOpen, setShareOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [shelterLoading, setShelterLoading] = useState(false);
  const [reliefForm, setReliefForm] = useState({ name: "", contact: "", needType: "food", description: "" });
  const [reliefMessage, setReliefMessage] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get(`/disasters/${id}`, { params: lat && lng ? { lat, lng } : {} })
      .then(({ data }) => setDisaster(data.disaster))
      .catch(() => setError("Could not load this disaster record."))
      .finally(() => setLoading(false));
  }, [id, lat, lng]);

  if (loading) return <p style={{ padding: "2rem" }}>Loading disaster details...</p>;
  if (error) return <div className="error-banner" style={{ margin: "2rem" }}>{error}</div>;
  if (!disaster) return null;

  const isLiveInfo = disaster.status === "Current" || disaster.status === "Forecast";
  const latitude = Number(disaster.latitude);
  const longitude = Number(disaster.longitude);
  const typeColor = colorForType(disaster.type);

  async function shareAlert() {
    const shareData = {
      title: disaster.name,
      text: `${disaster.name} - ${disaster.location_name}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); setShareOpen(true); }
      if (navigator.share) setShareLabel("Alert shared");
    } catch {
      setShareLabel("Share this alert");
    }
  }

  async function openShelters() {
    setModal("shelters");
    setShelterLoading(true);
    try {
      const { data } = await api.get("/shelters", { params: { lat: latitude, lng: longitude, radius: 25 } });
      setShelters(data.shelters || []);
    } catch (err) {
      setShelters([]);
    } finally {
      setShelterLoading(false);
    }
  }

  async function submitRelief(event) {
    event.preventDefault();
    setReliefMessage("");
    try {
      await api.post("/relief-requests", {
        disasterId: disaster.id,
        ...reliefForm,
        location: { lat: Number(reliefForm.latitude ?? latitude), lng: Number(reliefForm.longitude ?? longitude) },
      });
      setReliefMessage("Your related need was submitted successfully.");
      setReliefForm({ name: "", contact: "", needType: "food", description: "" });
    } catch (err) {
      setReliefMessage(err.response?.data?.error || "Could not submit the request.");
    }
  }

  return (
    <main className="detail-shell">
      <PublicPageHeader eyebrow="Disaster response" title={disaster.name} description={disaster.location_name || "Location not specified"} icon="map" />
      <div className="detail-card">
        <Link to="/map" className="detail-back-link">&larr; Back to Map</Link>

        <div className="detail-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/map">Disaster Map</Link>
          <span>/</span>
          <span>{disaster.location_name || "Selected area"}</span>
          <span>/</span>
          <span>{disaster.type}</span>
        </div>

        <div className="detail-layout">
          <div className="detail-main-column">
            <div className="detail-badges">
              <span className="detail-badge" style={{ background: `${typeColor}18`, color: typeColor }}>{disaster.type}</span>
              <span className={`detail-badge ${disaster.status === "Historical" ? "detail-badge-neutral" : "detail-badge-live"}`}>
                {disaster.status}
              </span>
              <span className={severityClass(disaster.severity)}>{disaster.severity} severity</span>
            </div>

            {isLiveInfo && (
              <div className="detail-alert">
                This is {disaster.status.toLowerCase()} information. Follow guidance from local authorities and official emergency services.
              </div>
            )}

            {disaster.description && <DetailSection title="Description"><p>{disaster.description}</p></DetailSection>}
            {disaster.affected_area && <DetailSection title="Affected Area"><p>{disaster.affected_area}</p></DetailSection>}
            {disaster.safety_information && <DetailSection title="Safety Information"><p>{disaster.safety_information}</p></DetailSection>}
            <DetailSection title="Source"><p className="detail-source">{disaster.source || "Source not specified"}</p></DetailSection>

            <div className="detail-actions">
              <button type="button" className="btn btn-relief" onClick={() => setModal("relief")}>Report a related need</button>
              <button type="button" className="btn btn-awareness" onClick={openShelters}>View nearby shelters</button>
              <div className="share-action"><button type="button" className="btn btn-outline-ink" onClick={shareAlert}>{shareLabel}</button>{shareOpen && <div className="share-popover"><strong>Share this alert</strong><button type="button" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy link</button><div><a href={`https://wa.me/?text=${encodeURIComponent(`${disaster.name} ${window.location.href}`)}`} target="_blank" rel="noreferrer">WhatsApp</a><a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(disaster.name)}&url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer">X</a><a href={`mailto:?subject=${encodeURIComponent(disaster.name)}&body=${encodeURIComponent(window.location.href)}`}>Email</a></div></div>}</div>
            </div>
            <p className="detail-teaser">Relief requests for this event will appear here soon.</p>
          </div>

          <aside className="detail-sidebar">
            <div className="detail-map-preview">
              {Number.isFinite(latitude) && Number.isFinite(longitude) ? (
                <MapContainer center={[latitude, longitude]} zoom={8} scrollWheelZoom={false} dragging={false} zoomControl={false} attributionControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[latitude, longitude]} icon={markerIcon} />
                </MapContainer>
              ) : <div className="detail-map-unavailable">Location preview unavailable</div>}
            </div>
            <div className="detail-facts">
              <div className="detail-facts-heading">Quick facts</div>
              <Fact label="Date" value={formatDate(disaster.date)} />
              <Fact label="Severity" value={disaster.severity} valueClass={severityClass(disaster.severity)} />
              {typeof disaster.distance_km === "number" && <Fact label="Distance" value={`${disaster.distance_km} km from selected location`} />}
              <Fact label="Coordinates" value={`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`} />
            </div>
          </aside>
        </div>
      </div>
      {modal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <section className="detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            {modal === "relief" ? (
              <>
                <h2>Report a related need</h2>
                <p className="modal-intro">Tell responders what support is needed for this event.</p>
                {reliefMessage && <div className="modal-message">{reliefMessage}</div>}
                <form onSubmit={submitRelief}>
                  <label className="modal-field">Name<input required value={reliefForm.name} onChange={(e) => setReliefForm({ ...reliefForm, name: e.target.value })} /></label>
                  <label className="modal-field">Contact<input required value={reliefForm.contact} onChange={(e) => setReliefForm({ ...reliefForm, contact: e.target.value })} /></label>
                  <label className="modal-field">Need type<select value={reliefForm.needType} onChange={(e) => setReliefForm({ ...reliefForm, needType: e.target.value })}>{["food", "water", "medical", "shelter", "rescue", "other"].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                  <label className="modal-field">Description<textarea required rows="4" value={reliefForm.description} onChange={(e) => setReliefForm({ ...reliefForm, description: e.target.value })} /></label>
                  <div className="modal-location"><strong>Location coordinates</strong><div className="modal-location-fields"><input type="number" step="any" value={reliefForm.latitude ?? latitude} onChange={(e) => setReliefForm({ ...reliefForm, latitude: e.target.value })} /><input type="number" step="any" value={reliefForm.longitude ?? longitude} onChange={(e) => setReliefForm({ ...reliefForm, longitude: e.target.value })} /></div></div>
                  <button className="btn btn-relief" type="submit">Submit need</button>
                </form>
              </>
            ) : (
              <>
                <h2>Nearby shelters</h2>
                <p className="modal-intro">Approved and active shelters within 25 km.</p>
                {shelterLoading ? <p>Loading shelters...</p> : shelters.length === 0 ? <div className="empty-state"><div className="empty-state-icon">⌂</div><strong>No nearby shelters yet</strong><p>Approved shelters will appear here when available.</p></div> : shelters.map((shelter) => (
                  <div className="shelter-result" key={shelter.id}><strong>{shelter.name}</strong><span>{Number(shelter.distance_km).toFixed(1)} km away · {shelter.current_occupancy}/{shelter.capacity} occupied</span>{shelter.facilities?.length > 0 && <small>{shelter.facilities.join(" · ")}</small>}{shelter.contact && <small>Contact: {shelter.contact}</small>}</div>
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function DetailSection({ title, children }) {
  return <section className="detail-section"><h2>{title}</h2>{children}</section>;
}

function Fact({ label, value, valueClass = "" }) {
  return <div className="detail-fact"><span>{label}</span><strong className={valueClass}>{value}</strong></div>;
}
