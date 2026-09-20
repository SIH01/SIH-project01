import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

const HELP_TYPES = [
  ["food", "Food", "🍲"], ["shelter", "Shelter", "⌂"], ["medical", "Medical", "✚"],
  ["mental_health", "Mental Health", "◌"], ["missing_person", "Missing People", "⌕"],
  ["financial", "Financial", "¤"], ["other", "Other", "•••"],
];
const EMPTY_FORM = { type: ["food"], name: "", phone: "", email: "", locationText: "", description: "", urgency: "medium" };
const EMPTY_MISSING_PERSON = { personName: "", age: "", lastKnownLocation: "", dateLastSeen: "" };
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function GetHelp() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [coords, setCoords] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [missingPerson, setMissingPerson] = useState(EMPTY_MISSING_PERSON);
  const [missingPhoto, setMissingPhoto] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationKind, setConfirmationKind] = useState("help");

  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function setMissing(key, value) { setMissingPerson((current) => ({ ...current, [key]: value })); }
  function hasHelpType(type) { return form.type.includes(type); }
  function toggleHelpType(type) {
    set("type", form.type.includes(type) ? form.type.filter((item) => item !== type) : [...form.type, type]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setError("Location is not available in this browser."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => { setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false); },
      () => { setError("Could not access your location. You can enter it manually."); setLocating(false); },
      { timeout: 8000 }
    );
  }

  async function handleFiles(event) {
    if (hasHelpType("missing_person")) {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_PHOTO_BYTES) { setError("The missing person's photo must be 2 MB or smaller."); event.target.value = ""; return; }
      setMissingPhoto({ name: file.name, url: await fileToDataUrl(file) });
      return;
    }
    const selected = Array.from(event.target.files || []).slice(0, 4);
    setPreviews(await Promise.all(selected.map(async (file) => ({ name: file.name, url: await fileToDataUrl(file) }))));
  }

  function removeFile(index) { setPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index)); }

  async function handleSubmit(event) {
    event.preventDefault(); setError("");
    if (!form.phone.trim() && !form.email.trim()) { setError("Please provide a phone number or email so an admin can follow up."); return; }
    if (form.type.length === 0) { setError("Select at least one type of help."); return; }
    if (!hasHelpType("missing_person") && !form.locationText.trim() && !coords) { setError("Add a location or attach your current location."); return; }
    if (form.description.trim().length < 10) { setError("Please describe what you need in at least 10 characters."); return; }
    if (hasHelpType("missing_person")) {
      if (!missingPerson.personName.trim() || !missingPerson.lastKnownLocation.trim() || !missingPerson.dateLastSeen) {
        setError("Add the missing person's name, last known location, and date last seen."); return;
      }
    }
    setSubmitting(true);
    try {
      if (hasHelpType("missing_person")) {
        const { data } = await api.post("/missing-persons", {
          reporter_name: form.name,
          reporter_contact: form.phone || form.email,
          person_name: missingPerson.personName,
          age: missingPerson.age ? parseInt(missingPerson.age, 10) : null,
          last_known_location: missingPerson.lastKnownLocation,
          date_last_seen: missingPerson.dateLastSeen,
          photo_url: missingPhoto?.url || null,
          description: form.description,
        });
        setConfirmation(data.report?.id);
        setConfirmationKind("missing");
        return;
      }
      const requests = await Promise.all(form.type.map((type) => api.post("/help-requests", {
        type, name: form.name, phone: form.phone, email: form.email,
        location: { text: form.locationText, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
        description: form.description, urgency: form.urgency, attachments: previews.map((preview) => preview.url),
      })));
      setConfirmation(requests.map(({ data }) => data.requestId || data.request?.request_id).join(", "));
      setConfirmationKind("help");
    } catch (err) { setError(err.response?.data?.error || "Could not submit your request. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (confirmation) {
    const isMissingReport = confirmationKind === "missing";
    return <main className="help-shell"><section className="help-card help-confirmation"><div className="confirmation-mark">✓</div><h1>{isMissingReport ? `Missing people report #${confirmation} received` : `Your request #${confirmation} has been received`}</h1><p>{isMissingReport ? "An administrator will review the report and approve it before it appears in the Missing People directory." : "An admin will review your request and follow up using the contact details you provided."}</p><div className="confirmation-actions"><button className="btn btn-relief" onClick={() => { setConfirmation(null); setConfirmationKind("help"); setForm(EMPTY_FORM); setMissingPerson(EMPTY_MISSING_PERSON); setMissingPhoto(null); setCoords(null); setPreviews([]); }}>Submit another request</button><Link className="btn btn-outline-ink" to="/">Return home</Link></div></section></main>;
  }

  return (
    <main className="help-shell">
      <PublicPageHeader eyebrow="Request support" title="Get Help" accentWord="Help" description="Request food, shelter, medical, mental-health, missing-person, or financial assistance. No account required - an admin will review and follow up." icon="hand" />
      <section className="help-card">
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <fieldset className="help-fieldset"><legend>Type of help needed</legend><div className="help-type-grid" role="group" aria-label="Type of help needed">{HELP_TYPES.map(([value, label, icon]) => <label key={value} className={`help-type-tile ${hasHelpType(value) ? "selected" : ""}`}><input type="checkbox" name="help-type" value={value} checked={hasHelpType(value)} onChange={() => toggleHelpType(value)} /><span className="help-type-icon" aria-hidden="true">{icon}</span><span>{label}</span></label>)}</div></fieldset>
          <fieldset className="help-fieldset"><legend>Urgency</legend><div className="urgency-group" role="radiogroup" aria-label="Urgency">{[["low", "Low"], ["medium", "Medium"], ["critical", "Critical"]].map(([value, label]) => <label key={value} className={`urgency-option urgency-${value} ${form.urgency === value ? "selected" : ""}`}><input type="radio" name="urgency" value={value} checked={form.urgency === value} onChange={() => set("urgency", value)} /><span>{label}</span></label>)}</div></fieldset>
          <div className="help-field"><label htmlFor="help-name">Your name</label><input id="help-name" value={form.name} onChange={(e) => set("name", e.target.value)} required /></div>
          <div className="help-contact-grid"><div className="help-field"><label htmlFor="help-phone">Phone (optional)</label><input id="help-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div><div className="help-field"><label htmlFor="help-email">Email (optional)</label><input id="help-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div></div>
          <p className="help-hint">At least one of phone or email is required so we can follow up.</p>
          {hasHelpType("missing_person") && <>
            <div className="help-field"><label htmlFor="missing-person-name">Person's name</label><input id="missing-person-name" value={missingPerson.personName} onChange={(e) => setMissing("personName", e.target.value)} required /></div>
            <div className="help-contact-grid"><div className="help-field"><label htmlFor="missing-person-age">Age (if known)</label><input id="missing-person-age" type="number" min="0" max="149" value={missingPerson.age} onChange={(e) => setMissing("age", e.target.value)} /></div><div className="help-field"><label htmlFor="missing-person-date">Date last seen</label><input id="missing-person-date" type="date" value={missingPerson.dateLastSeen} onChange={(e) => setMissing("dateLastSeen", e.target.value)} required /></div></div>
            <div className="help-field"><label htmlFor="missing-person-location">Last known location</label><input id="missing-person-location" value={missingPerson.lastKnownLocation} onChange={(e) => setMissing("lastKnownLocation", e.target.value)} required /></div>
          </>}
          <div className="help-field"><label htmlFor="help-location">Location</label><input id="help-location" placeholder="e.g. Ward 4, Silchar, Assam" value={form.locationText} onChange={(e) => set("locationText", e.target.value)} /><button type="button" className="location-button" onClick={useMyLocation} disabled={locating}>{locating ? "Locating..." : coords ? "📍 Location attached" : "📍 Attach my current location"}</button>{coords && <small className="coords-note">Coordinates attached: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</small>}</div>
          <div className="help-field"><label htmlFor="help-description">Describe what you need</label><textarea id="help-description" rows="5" value={form.description} onChange={(e) => set("description", e.target.value)} required /><small className="help-hint">Please include useful details for the response team.</small></div>
          <div className="help-field"><label htmlFor="help-files">{hasHelpType("missing_person") ? "Photo of the missing person - optional" : "Add a photo - optional"}</label><input id="help-files" type="file" accept="image/*" multiple={!hasHelpType("missing_person")} onChange={handleFiles} />{hasHelpType("missing_person") ? (missingPhoto && <div className="file-previews"><div className="file-preview"><img src={missingPhoto.url} alt={missingPhoto.name} /><button type="button" onClick={() => setMissingPhoto(null)} aria-label={`Remove ${missingPhoto.name}`}>×</button></div></div>) : <div className="file-previews">{previews.map((preview, index) => <div className="file-preview" key={preview.name}><img src={preview.url} alt={preview.name} /><button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${preview.name}`}>×</button></div>)}</div>}</div>
          <button className="btn submit-help-button" type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit request"}</button>
        </form>
      </section>
    </main>
  );
}
