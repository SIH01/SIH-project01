import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api";
import NotificationBell from "./NotificationBell.jsx";

const navItems = [
  ["/", "Home", true], ["/map", "Disaster Map"], ["/get-help", "Get Help"],
  ["/missing-persons", "Missing People"], ["/fundraising", "Fundraising"],
  ["/organizations", "Organizations"], ["/my-requests", "My Requests"], ["/about", "About"],
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeAlerts, setActiveAlerts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadCount = () => api.get("/disasters/active-count")
      .then(({ data }) => { if (!cancelled) setActiveAlerts(data.count); })
      .catch(() => { if (!cancelled) setActiveAlerts(null); });
    loadCount();
    const timer = setInterval(loadCount, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const linkClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <NavLink to="/" end className="nav-brand">
          <span className="nav-brand-mark" aria-hidden="true"><span>✓</span></span>
          <span>DisasterShield</span>
        </NavLink>

        <div className="nav-links">
          {navItems.map(([path, label, end]) => <NavLink key={path} to={path} end={end} className={linkClass}>{label}</NavLink>)}
          {user?.role === "organization" ? <NavLink to="/organization/dashboard" className={linkClass}>Organization Dashboard</NavLink> : <NavLink to="/org/login" className={linkClass}>Organization Portal</NavLink>}
          <NavLink to="/map?status=active" className="nav-alert-chip"><span className="nav-alert-dot" />{activeAlerts == null ? "Live alerts" : `${activeAlerts} active alert${activeAlerts === 1 ? "" : "s"}`}</NavLink>

          {!user && <NavLink to="/login" className="nav-login">Login</NavLink>}
          {user && user.role === "user" && <span className="nav-greeting">Hi, {user.name}</span>}
          {user && user.role === "admin" && (
            <>
              <NavLink to="/admin/dashboard" className={linkClass}>Admin Dashboard</NavLink>
              <NavLink to="/admin/assistance" className={linkClass}>Help Requests</NavLink>
            </>
          )}
          {user && <NotificationBell />}
          {user && <button onClick={handleLogout} className="nav-logout">Logout</button>}
        </div>
      </div>
    </nav>
  );
}