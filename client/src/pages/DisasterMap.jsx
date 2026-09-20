import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { api } from "../services/api";
import { DISASTER_TYPES, colorForType, radiusForSeverity } from "../utils/disasterOptions";
import { applyDisasterFilters, DEFAULT_FILTERS } from "../utils/filterDisasters";
import DisasterFilters from "../components/DisasterFilters";
import RiskSummary from "../components/RiskSummary";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const RADIUS_OPTIONS = [25, 50, 100];

function normalizeLongitude(value) {
  const longitude = Number(value);
  if (!Number.isFinite(longitude)) return 0;
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function normalizeLatitude(value) {
  return Math.max(-90, Math.min(90, Number(value)));
}

async function readUtf8Json(response) {
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const bytes = await response.arrayBuffer();
  return JSON.parse(new TextDecoder("utf-8").decode(bytes));
}

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: normalizeLatitude(e.latlng.lat), lng: normalizeLongitude(e.latlng.lng) });
    },
  });
  return null;
}

function MapFocus({ disaster, onReady }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  useEffect(() => {
    if (!disaster) return;
    map.flyTo([Number(disaster.latitude), normalizeLongitude(disaster.longitude)], Math.max(map.getZoom(), 8), {
      duration: 0.7,
    });
  }, [disaster, map]);

  return null;
}

function MapLegend() {
  return (
    <div className="map-legend">
      <strong>Disaster types</strong>
      {DISASTER_TYPES.map((type) => (
        <div key={type} className="map-legend-item">
          <span className="map-legend-dot" style={{ background: colorForType(type) }} />
          {type}
        </div>
      ))}
    </div>
  );
}

function shortenLabel(displayName) {
  return displayName ? displayName.split(",").slice(0, 3).join(",") : null;
}

function severityClass(severity) {
  if (severity === "High" || severity === "Severe") return "risk-severity risk-severity-high";
  if (severity === "Moderate") return "risk-severity risk-severity-medium";
  return "risk-severity risk-severity-low";
}

export default function DisasterMap() {
  const [searchParams] = useSearchParams();
  const activeOnly = searchParams.get("status") === "active";
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const [disasters, setDisasters] = useState([]);
  const [loadingDisasters, setLoadingDisasters] = useState(false);
  const [disasterError, setDisasterError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [radiusKm, setRadiusKm] = useState(50);
  const [selectedDisasterId, setSelectedDisasterId] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  // Fetch nearby disasters whenever the selected point changes.
  useEffect(() => {
    if (!selected) {
      setDisasters([]);
      return;
    }
    let cancelled = false;
    setLoadingDisasters(true);
    setDisasterError("");
    api
      .get("/disasters/nearby", { params: { lat: selected.lat, lng: selected.lng, radius: radiusKm } })
      .then(({ data }) => {
        if (!cancelled) setDisasters(data.disasters);
      })
      .catch(() => {
        if (!cancelled) setDisasterError("Could not load disaster records for this area.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDisasters(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.lat, selected?.lng, radiusKm]);

  // Fill in a readable location name if we only have raw coordinates (map click).
  useEffect(() => {
    if (!selected || selected.label) return;
    let cancelled = false;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selected.lat}&lon=${selected.lng}`, {
      headers: { Accept: "application/json; charset=utf-8" },
    })
      .then(readUtf8Json)
      .then((data) => {
        if (cancelled) return;
        const label = shortenLabel(data.display_name);
        if (label) {
          setSelected((prev) =>
            prev && prev.lat === selected.lat && prev.lng === selected.lng ? { ...prev, label } : prev
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchTerm)}`
      );
      const results = await readUtf8Json(res);
      if (results.length === 0) {
        setSearchError("No matching location found.");
        return;
      }
      setSelected({
        lat: normalizeLatitude(results[0].lat),
        lng: normalizeLongitude(results[0].lon),
        label: shortenLabel(results[0].display_name),
      });
    } catch (err) {
      setSearchError("Search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  const filteredDisasters = applyDisasterFilters(activeOnly ? disasters.filter((disaster) => disaster.status === "Current") : disasters, filters);
  const selectedDisaster = disasters.find((disaster) => disaster.id === selectedDisasterId);

  function focusDisaster(disaster) {
    setSelectedDisasterId(disaster.id);
    if (mapInstance) {
      mapInstance.flyTo([Number(disaster.latitude), normalizeLongitude(disaster.longitude)], Math.max(mapInstance.getZoom(), 8), {
        duration: 0.7,
      });
    }
  }

  return (
    <div className="map-page">
      <PublicPageHeader eyebrow="Disaster response" title="Disaster Map" accentWord="Map" description="Explore disaster records by location, severity, and search radius." icon="map" />
      <div
        style={{
          padding: "1.25rem 2rem",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.6rem", flex: 1, minWidth: "260px" }}>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search a city or place…"
            style={{ flex: 1, padding: "0.6rem 0.9rem", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "0.95rem" }}
          />
          <button className="btn btn-outline-ink" type="submit" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
          <select
            className="radius-select"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            aria-label="Search radius"
          >
            {RADIUS_OPTIONS.map((radius) => <option key={radius} value={radius}>{radius} km radius</option>)}
          </select>
        </form>
      </div>

      {selected && (
        <div className="map-overview-card">
          <div className="selected-location">
            <div className="selected-location-mark" aria-hidden="true">⌖</div>
            <div className="map-section-title">Selected Location</div>
            {selected.label && <div className="selected-location-name">{selected.label}</div>}
            <div className="selected-coordinates">
              <span>Lat {selected.lat.toFixed(4)}</span>
              <span>Lon {selected.lng.toFixed(4)}</span>
            </div>
            <div className="selected-radius">Search radius: {radiusKm} km</div>
          </div>

          {!loadingDisasters && disasters.length > 0 && (
            <RiskSummary locationName={selected.label || `${selected.lat.toFixed(2)}, ${selected.lng.toFixed(2)}`} radiusKm={radiusKm} disasters={disasters} />
          )}
        </div>
      )}

      {disasterError && <div className="error-banner" style={{ margin: "1rem 2rem" }}>{disasterError}</div>}

      {selected && (
        <div style={{ margin: "1rem 2rem 0" }}>
          <DisasterFilters filters={filters} onChange={setFilters} />
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", margin: "1rem 2rem 0", flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: "320px", height: "65vh" }}>
          <MapContainer center={[20.5937, 78.9629]} zoom={4} style={{ height: "100%", width: "100%", borderRadius: "6px" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapFocus disaster={selectedDisaster} onReady={setMapInstance} />
            <ClickHandler onSelect={setSelected} />
            <MapLegend />
            {selected && (
              <>
                <Marker position={selected} icon={markerIcon} />
                <Circle center={selected} radius={radiusKm * 1000} pathOptions={{ color: "#2f6f76", fillOpacity: 0.08 }} />
              </>
            )}
            {filteredDisasters.map((d) => (
              <CircleMarker
                key={d.id}
                center={[Number(d.latitude), normalizeLongitude(d.longitude)]}
                radius={radiusForSeverity(d.severity)}
                eventHandlers={{ click: () => focusDisaster(d) }}
                pathOptions={{
                  color: selectedDisasterId === d.id ? "#101b2d" : colorForType(d.type),
                  fillColor: colorForType(d.type),
                  fillOpacity: 0.8,
                  weight: selectedDisasterId === d.id ? 4 : 2,
                }}
              >
                <Popup>
                  <div style={{ minWidth: "180px" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{d.name}</div>
                    <div>{d.type} · {d.status}</div>
                    <div>{new Date(d.date).toLocaleDateString()}</div>
                    <div>Severity: {d.severity}</div>
                    <div style={{ color: "var(--awareness-dark)", fontWeight: 600, marginBottom: "0.4rem" }}>
                      {d.distance_km} km away
                    </div>
                    <Link to={`/disasters/${d.id}?lat=${selected.lat}&lng=${selected.lng}`}>View full details →</Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {selected && (
          <div className="disaster-results-panel" style={{ flex: 1, minWidth: "260px", height: "65vh", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "6px" }}>
            {loadingDisasters ? (
              <p style={{ padding: "1rem" }}>Loading disaster records…</p>
            ) : filteredDisasters.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" aria-hidden="true">⌕</div>
                <strong>No disasters found</strong>
                <p>Try widening the radius or changing your filters.</p>
              </div>
            ) : (
              filteredDisasters.map((d) => (
                  <div
                  key={d.id}
                    className={`disaster-result ${selectedDisasterId === d.id ? "disaster-result-selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => focusDisaster(d)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") focusDisaster(d);
                    }}
                >
                    <div style={{ fontWeight: 700 }}>{d.location_name || d.name}</div>
                    <div className="disaster-result-meta">
                      <span>{d.type}</span>
                      <span className={severityClass(d.severity)}>{d.severity}</span>
                      <span>{d.distance_km} km away</span>
                  </div>
                    <Link
                      to={`/disasters/${d.id}?lat=${selected.lat}&lng=${selected.lng}`}
                      onClick={(event) => event.stopPropagation()}
                      className="disaster-result-link"
                    >
                      View details →
                    </Link>
                  </div>
              ))
            )}
          </div>
        )}
      </div>

      <p className="map-help-text" style={{ padding: "1rem 2rem", fontSize: "0.9rem" }}>
        Click anywhere on the map to drop a pin, or search above. Disaster markers within {radiusKm} km
        of your selected point appear automatically — filter, sort, or click any record for full details.
      </p>
    </div>
  );
}