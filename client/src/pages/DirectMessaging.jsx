import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import "./contactPortal.css";

const ROLES = { seeker: "Help Seeker", organization: "Organization" };

function formatTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function DirectMessaging() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [role, setRole] = useState("seeker");
  const [request, setRequest] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const trackingId = params.get("tracking_id") || "";
  const loadThread = async () => {
    const endpoint = role === "organization" ? `/contact-threads/organization/${id}` : `/contact-threads/mine/${id}`;
    const options = role === "organization" ? undefined : { params: trackingId ? { tracking_id: trackingId } : {} };
    const { data } = await api.get(endpoint, options);
    setRequest(data.request);
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadThread().catch((err) => { setError(err.response?.data?.error || "Could not load this conversation."); setLoading(false); });
    const timer = window.setInterval(() => loadThread().catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, [id, role, trackingId]);

  async function send(event) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const endpoint = role === "organization" ? `/contact-threads/organization/${id}/messages` : `/contact-threads/mine/${id}/messages`;
      const options = role === "organization" ? undefined : { params: trackingId ? { tracking_id: trackingId } : {} };
      const { data } = await api.post(endpoint, { body: message.trim() }, options);
      setRequest(data.request);
      setMessage("");
      setError("");
    } catch (err) { setError(err.response?.data?.error || "Could not send your message."); }
    finally { setSending(false); }
  }

  const messages = request?.messages || [];
  return (
    <main className="direct-message-page">
      <Link to={role === "organization" ? "/organization/dashboard" : "/my-requests"} className="back-link">← Back</Link>
      <section className="direct-message-shell">
        <header className="direct-message-header">
          <div>
            <p className="eyebrow">Direct support conversation</p>
            <h1>{request?.organization_name || "Organization conversation"}</h1>
            <p>{request ? `${request.category} help · ${request.requester_name} · ${request.tracking_id}` : "Loading request context…"}</p>
          </div>
          <div className="role-switcher" aria-label="Prototype role selection">
            {Object.entries(ROLES).map(([value, label]) => <button key={value} type="button" className={role === value ? "selected" : ""} onClick={() => setRole(value)}>{label}</button>)}
          </div>
        </header>
        {error && <div className="error-banner">{error}</div>}
        <div className="message-stream direct-message-stream">
          {loading ? <p className="chat-empty">Loading conversation…</p> : messages.length === 0 ? <div className="chat-empty"><strong>No messages yet</strong><span>Send the first message to begin this conversation.</span></div> : messages.map((item) => {
            const mine = item.sender_role === (role === "organization" ? "organization" : "citizen");
            return <div className={`chat-message ${mine ? "mine" : "theirs"}`} key={item.id}><div className="chat-bubble"><p>{item.body}</p><time>{formatTime(item.created_at)}</time></div></div>;
          })}
        </div>
        <form className="direct-message-composer" onSubmit={send}>
          <input aria-label="Message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" maxLength="4000" />
          <button type="submit" className="btn btn-relief" disabled={!message.trim() || sending}>{sending ? "Sending…" : "Send"}</button>
        </form>
        <p className="prototype-note">Prototype role switch only. Production must use authenticated, verified identities and push notifications.</p>
      </section>
    </main>
  );
}
