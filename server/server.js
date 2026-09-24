const fs = require("fs");
const path = require("path");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const disasterRoutes = require("./routes/disasterRoutes");
const assistanceRoutes = require("./routes/assistanceRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const missingPersonRoutes = require("./routes/missingPersonRoutes");
const campaignRoutes = require("./routes/campaignRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const reliefRequestRoutes = require("./routes/reliefRequestRoutes");
const shelterRoutes = require("./routes/shelterRoutes");
const helpRequestRoutes = require("./routes/helpRequestRoutes");
const orgMatchRoutes = require("./routes/orgMatchRoutes");
const contactThreadRoutes = require("./routes/contactThreadRoutes");
const organizationHelpRoutes = require("./routes/organizationHelpRoutes");
const { runActiveAlertJob } = require("./jobs/activeAlertJob");

const app = express();

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// Stage 11 — basic hardening. helmet sets sane security headers; the
// general limiter covers the whole API, with a stricter one on auth
// endpoints (the most common target for credential-stuffing/spam).
// The default CSP only allows same-origin resources, which silently
// blocks the map tiles, marker icons, and fonts this app loads from
// other domains — so those are explicitly allow-listed here.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "*.tile.openstreetmap.org", "unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        connectSrc: ["'self'", "nominatim.openstreetmap.org", "*.tile.openstreetmap.org", "https://api.razorpay.com"],
        scriptSrc: ["'self'", "https://checkout.razorpay.com"],
        frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      },
    },
  })
);
app.use(cors());
app.use(express.json({ limit: "6mb", verify: (req, res, buffer) => {
  if (req.originalUrl === "/api/campaigns/webhook/razorpay") req.rawBody = Buffer.from(buffer);
} }));

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/", generalLimiter);
app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", stage: 14 });
});

app.use("/api/auth", authRoutes);
app.use("/api/disasters", disasterRoutes);
app.use("/api/assistance", assistanceRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/missing-persons", missingPersonRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/relief-requests", reliefRequestRoutes);
app.use("/api/shelters", shelterRoutes);
app.use("/api/help-requests", helpRequestRoutes);
app.use("/api/org-matching", orgMatchRoutes);
app.use("/api/contact-threads", contactThreadRoutes);
app.use("/api/org", organizationHelpRoutes);

const ACTIVE_ALERT_POLL_MS = 15 * 60 * 1000;
runActiveAlertJob().catch((error) => console.error("initial active alert job error:", error.message));
setInterval(() => {
  runActiveAlertJob().catch((error) => console.error("active alert job error:", error.message));
}, ACTIVE_ALERT_POLL_MS);

// Serve the built frontend (client/dist) from this same server/port, once
// it exists. This means ONE Cloudflare Tunnel to this port covers both the
// site and the API — no separate frontend tunnel, and no tunnel URL ever
// needs to be hardcoded in the frontend (it calls a relative "/api" path).
// Run "npm run build" in client/ to produce client/dist before this works;
// in local dev, keep using "npm run dev" in client/ instead (Vite serves
// it on 5174 and proxies /api to this server — see client/vite.config.js).
const clientDistPath = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`DisasterShield API running on http://localhost:${PORT}`);
});
