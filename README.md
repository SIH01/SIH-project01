# DisasterShield

DisasterShield is a disaster awareness and relief coordination web app.

It helps people:

- View disaster records near a selected location.
- See active alerts.
- Submit a request for help.
- Find approved nearby shelters.
- Find verified relief organizations.

Administrators manage disaster records, alerts, help requests, organizations, and shelters.

The project uses:

- React and Vite for the frontend.
- Node.js and Express for the backend.
- PostgreSQL/Supabase for the database.
- Leaflet and React Leaflet for maps.
- JWT tokens for login and role protection.

## Requirements

Install these before starting:

- Node.js 18 or newer.
- npm.
- A PostgreSQL or Supabase database.
- A modern browser with JavaScript enabled.

Node 18 or newer is needed because the backend uses the built-in `fetch` API for the USGS feed.

## First-Time Setup

### 1. Install dependencies

Open PowerShell in the project folder:

```powershell
cd D:\VScode\SIH-project01\server
npm install

cd ..\client
npm install
```

### 2. Create the backend environment file

Copy `server/.env.example` to `server/.env`.

Set these values:

```env
PORT=5001
JWT_SECRET=use_a_long_random_secret
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_DATABASE_HOST:5432/postgres

# Razorpay Route. Keep secrets only in server/.env.
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Do not commit `server/.env` or expose the database password.

For Supabase, use the Session Pooler connection string if the direct database host cannot be resolved.

Razorpay Route also requires a verified Razorpay linked account for every organization that receives donations. Store that linked account ID in `organizations.razorpay_account_id`. Configure the Razorpay webhook URL as `https://YOUR_PUBLIC_HOST/api/campaigns/webhook/razorpay` and subscribe to `payment.captured`. Do not expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in the client.

### 3. Create the database tables

Run these SQL files in the Supabase or PostgreSQL SQL editor, in this order:

1. `server/db/schema_stage1.sql` - users and roles.
2. `server/db/schema_stage3.sql` - disaster records.
3. `server/db/schema_stage5.sql` - assistance requests.
4. `server/db/schema_stage6.sql` - organizations.
5. `server/db/schema_stage7.sql` - organization responses.
6. `server/db/schema_stage8.sql` - missing-person records.
7. `server/db/schema_stage9.sql` - fundraising campaigns.
8. `server/db/schema_stage10.sql` - notifications and audit logs.
9. `server/db/schema_stage11.sql` - relief requests and shelters.
10. `server/db/schema_stage12.sql` - public Get Help requests.
11. `server/db/schema_stage13.sql` - active-alert lifecycle fields.
12. `server/db/schema_stage14.sql` - organization request claiming and matching.
13. `server/db/schema_stage15.sql` - verified organization contact threads and messages.
14. `server/db/schema_stage16.sql` - Get Help organization routing, assignments, and messages.
15. `server/db/schema_stage17.sql` - organization missing-person case updates.
16. `server/db/schema_stage18.sql` - campaign donation records used by the payment flow.
17. `server/db/schema_stage19.sql` - Razorpay Route payment and organization account state.


### Verified organization contact portal

The public directory now links to `/organizations/:id/contact`. A person can submit a low-friction request to a verified organization, receive a `DS-XXXXXXXX` tracking ID, and continue the conversation from `/my-requests` using that ID or a citizen account. Requests include category, urgency, location, optional attachment link, status, and an append-only message history.

Organizations use the separate `/org/login` route and land at `/organization/dashboard`. Portal sessions require a verified organization and the `organization_portal` JWT scope. The portal provides an inbox, urgency/status/category filters, request status updates, threaded replies, and 15-second polling for new messages. API routes are grouped under `/api/contact-threads`:

- `POST /` - create a request; public with optional citizen auth.
- `GET /mine` and `GET /mine/:id` - list or view citizen requests by account or tracking ID.
- `POST /mine/:id/messages` - continue a citizen conversation.
- `GET /organization` and `GET /organization/:id` - verified organization inbox and thread.
- `POST /organization/:id/messages` - organization reply.
- `PATCH /organization/:id/status` - set `Pending`, `Seen`, `In Progress`, or `Resolved`.

The current notification behavior is in-app polling rather than email/SMS. The existing notification bell remains available for authenticated users; email/SMS delivery can be attached to the organization reply transaction later without changing the thread schema.

The organization portal's Get Help API is separate from the direct-contact thread API:

- `POST /api/org/login` - organization-only login; verified accounts receive an isolated `organization_portal` JWT scope.
- `GET /api/org/dashboard/stats` - verified organization overview metrics.
- `GET /api/organizations/me` and `PATCH /api/organizations/me` - view and update the logged-in organization's profile, services, operating area, and coordinates.
- `GET /api/org/requests` - category/region-matched and admin-assigned Get Help requests, with status, urgency, type, search, and claim filters.
- `GET /api/org/requests/:id` - request details, routing reason, claim state, and conversation history.
- `POST /api/org/requests/:id/claim` - atomically claim an unclaimed request and move it to `in_progress`.
- `POST /api/org/requests/:id/messages` - send an organization reply.
- `PATCH /api/org/requests/:id/status` - update status and optional internal notes.
- `PATCH /api/admin/help-requests/:id/assign` - admin-only manual assignment to a verified organization.

Matching normalizes the Get Help type (`food`, `mental_health`, and so on) against organization service tags, then applies a 50 km coordinate check when both sides have coordinates. Admin assignments bypass category/region matching. A request claimed by another organization remains visible with a non-actionable state so duplicate outreach is avoided.
The latest features require all of these tables. If the new disaster endpoints return `Could not load disasters`, the schema files are usually missing from the database.

### 4. Add demo data

Run one seed file after the schema files:

- `server/db/seed_demo_data.sql` - general demo records.
- `server/db/seed_demo_data_assam.sql` - Assam-focused demo records.
- `server/db/seed_demo_data_assam_2.sql` - additional Assam records.

Run a seed file only when you want demo data. Do not run the same seed repeatedly if it inserts duplicate records.

### 5. Create an admin account

From the `server` directory:

```powershell
node scripts/createAdmin.js
```

Follow the prompts. The admin account is required for admin pages, active alerts, organization approval, shelter review, and help-request triage.

## Start the App

Use two terminals.

### Terminal 1: backend

```powershell
cd D:\VScode\SIH-project01\server
npm run dev
```

The backend runs at `http://localhost:5001`.

Check it here:

`http://localhost:5001/api/health`

Expected response:

```json
{"status":"ok","stage":12}
```

### Terminal 2: frontend

```powershell
cd D:\VScode\SIH-project01\client
npm run dev
```

The frontend normally runs at `http://localhost:5174`.

If the port is busy, Vite may use another port such as `5175`. Use the URL printed in the terminal.

### Production build

```powershell
cd D:\VScode\SIH-project01\client
npm run build
```

The build output is created in `client/dist`.

## Public Features

### Home

The home page explains the product and links to the main workflows.

### Disaster Map

Open `/map` or click **Disaster Map**.

How it works:

1. Search for a place, such as `Guwahati`, `Silchar`, or `Haflong`.
2. Or click directly on the map.
3. The app gets the selected latitude and longitude.
4. The backend finds disasters within the selected radius.
5. The map shows colored markers by disaster type.
6. The results list can be filtered by type, severity, status, time, and sort order.
7. Clicking a result moves the map to that event and highlights its marker.

The radius can be set to `25`, `50`, or `100 km`.

The active-alert chip in the navbar opens `/map?status=active` and shows only currently active disasters.

### Disaster details

Click **View details** on a map result.

The detail page shows:

- Disaster type, status, severity, and location.
- Description and affected area.
- Safety information.
- Source information.
- Date, coordinates, and distance from the selected point.
- A small map preview.
- Related-help submission.
- Nearby approved shelter lookup.
- Share and copy-link actions.

### Get Help

Open `/get-help`.

1. Select a help type.
2. Select urgency: Low, Medium, or Critical.
3. Enter your name.
4. Add at least one phone number or email address.
5. Enter a location or attach the current location.
6. Describe the need in at least 10 characters.
7. Optionally add image attachments.
8. Submit the request.

After a successful submission, the page shows a request reference such as `GH-2001`.

The backend also validates these rules. Frontend validation alone is not trusted.

Public help submissions are limited to 5 submissions per IP address every 15 minutes.

### Organizations

Open `/organizations` to view approved organizations.

To register:

1. Open **Register your organization**.
2. Enter the organization details and representative details.
3. Add assistance categories and verification information.
4. Submit the registration.

An organization can log in, but it must be verified by an admin before it can submit shelters or manage organization features.

### Organization shelters

Verified organizations can open `/organization/dashboard`.

They can:

- Add a shelter.
- Set coordinates, capacity, occupancy, contact, and facilities.
- View their submitted shelters.
- Edit their own shelters.
- See whether each shelter is pending, approved, or rejected.

New shelters are always pending first. They do not appear in public shelter results until an admin approves them.

Editing an approved shelter sends it back to pending review.

### Fundraising and payments

Open `/fundraising` to browse verified active campaigns. Each campaign has a shareable URL such as `/fundraising/1` and shows its creator, goal, raised amount, progress percentage, status, and recent confirmed donors. Campaign detail pages poll the server so viewers see shared totals and donor updates.

Organizations create campaigns from `/organization/campaigns`. Campaigns remain private until an administrator verifies the organization and activates the campaign. Administrators review campaigns at `/admin/campaigns`.

Donations use Razorpay Route:

1. The donor enters an optional name and a positive amount.
2. The server checks that the campaign is active, the organization has a Razorpay linked account, and the amount does not exceed the remaining goal.
3. The server creates a Razorpay order with a pending donation record.
4. Razorpay Checkout handles the payment in the browser.
5. The server verifies Razorpay's signed `payment.captured` webhook.
6. Only after webhook verification does the donation become visible, increase `amount_raised`, and appear in Recent donors.

Opening the form, entering a name, cancelling Checkout, or calling the browser callback does not create a confirmed donation. The payment webhook is the source of truth. The current policy closes donations at the campaign goal and does not allow overfunding.

Payment endpoints:

```text
GET  /api/campaigns
GET  /api/campaigns/:id
POST /api/campaigns/:id/payment-order       public donor checkout start
POST /api/campaigns/webhook/razorpay        Razorpay signed webhook
POST /api/campaigns                          verified organization
PUT  /api/campaigns/:id/verify               admin
```

Razorpay Route transfers funds to the organization's linked account. A payment being captured means Razorpay accepted the payment; bank settlement can still happen later according to Razorpay's settlement schedule. The application records the donor after capture, not after an unverified browser action.

### Missing people

Open `/missing-persons` to browse public reports and use the report form to submit a missing-person case. Reports support identity details, last-seen information, location, description, urgency, contact details, and optional attachments. Public submissions receive a confirmation reference. Administrators review, edit, publish, or remove reports from `/admin/missing-persons`.

Verified organizations can review routed missing-person cases from their organization portal, add case updates, and escalate a case for administrator attention. Organization updates are append-only so the case history is preserved.

### Direct contact with organizations

From `/organizations`, a visitor can open a verified organization's profile and use `/organizations/:id/contact` to send a support request without needing an account. The system returns a `DS-XXXXXXXX` tracking ID. A citizen can continue the conversation from `/my-requests` using that ID or a citizen account.

Messages are stored as a thread. Citizens can send follow-up messages, while verified organization staff can reply, change status, and resolve the thread. Current statuses are `Pending`, `Seen`, `In Progress`, and `Resolved`. Notifications are currently delivered through in-app polling and the notification bell; email and SMS are not enabled.

### Citizen accounts

Citizens can register and log in to track help requests and organization conversations. Public help and contact forms remain available without an account. Authenticated requests use a JWT bearer token, while organization portal sessions use a separate organization scope.

### Organization response portal

Verified organizations use `/org/login` or `/organization/login` and land at `/organization/dashboard`. The portal provides:

- Dashboard statistics and organization profile management.
- Nearby and assigned help requests.
- Category, urgency, region, search, and claim filters.
- Atomic request claiming to prevent duplicate response work.
- Request conversations, replies, internal notes, and status updates.
- Missing-person case updates and escalation.
- Campaign creation and campaign amount management.
- Shelter submission and shelter management.

Get Help matching normalizes request categories against organization service tags and applies a 50 km coordinate check when both sides have coordinates. Administrator assignments bypass matching. A request claimed by another organization remains visible but cannot be claimed again.

## Admin Features

Log in at `/admin/login`, then open `/admin/dashboard`.

### Manage disasters

The admin can:

- Add a disaster record.
- Choose its type, status, severity, date, location, coordinates, description, safety information, and source.
- Edit disaster details.
- Delete a disaster record.

### Active alerts

Open `/admin/active-alerts`.

The admin can:

- View active alerts.
- See creation time, expiry countdown, and last confirmation time.
- Keep an alert active.
- Mark an alert historical.
- Mark an alert resolved.
- Extend an alert by 24 or 72 hours.
- Edit alert details.
- Add a new active alert manually.

Alerts close automatically when `active_until` passes. An admin extension updates the expiry time and records the confirming admin.

The backend also polls the USGS earthquake feed every 15 minutes. It checks the configured region, imports new qualifying earthquakes as active alerts, and avoids duplicate records.

Set this optional environment variable to change the automatic active window:

```env
ACTIVE_ALERT_WINDOW_HOURS=72
```

### Help request triage

Open `/admin/assistance`.

The admin can:

- Filter by urgency and status.
- Sort by urgency or newest date.
- See the request reference, contact information, location, and description.
- Change status: New, In review, In progress, Resolved, or Closed.
- Assign a request to a verified organization.

Critical requests use a red urgency indicator. Medium requests use amber. Low requests use green.

### Relief requests

Open `/admin/relief-requests` to manage related needs submitted from disaster detail pages.

Statuses are:

- `pending`
- `in_progress`
- `resolved`

### Organization verification

Open `/admin/organizations`.

The admin can inspect pending organization details and approve or reject them. Only approved organizations can submit shelters.

### Shelter review

Open `/admin/shelters`.

The admin can:

- Review pending shelter submissions.
- See the submitting organization, coordinates, capacity, occupancy, facilities, and contact.
- Approve or reject a shelter.
- Add a rejection note.
- Review previously approved or rejected shelters.

## Active Alert Logic

The database uses the existing project status names:

- `Current` means active.
- `Historical` means no longer active.
- `Resolved` means the event has been closed.
- `Forecast` is used for forecast records.

The API also accepts the simpler alert values `active`, `historical`, and `resolved` on admin status routes.

Important fields:

- `active_until` - when the active alert should expire.
- `last_confirmed_by` - the admin who last confirmed or extended it.
- `last_confirmed_at` - when that confirmation happened.

Available active-alert endpoints:

```text
GET   /api/disasters/active-count
GET   /api/disasters?status=active
PATCH /api/disasters/:id/status
PATCH /api/disasters/:id/extend
POST  /api/disasters
PATCH /api/disasters/:id
```

The active count endpoint is public and returns:

```json
{
  "count": 0,
  "updatedAt": "2026-09-10T00:00:00.000Z"
}
```

## Main API Routes

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/admin-login
POST /api/auth/organization-login
```

### Disasters

```text
GET    /api/disasters
GET    /api/disasters/nearby?lat=&lng=&radius=
GET    /api/disasters/:id
POST   /api/disasters                 admin
PATCH  /api/disasters/:id             admin
PATCH  /api/disasters/:id/status      admin
PATCH  /api/disasters/:id/extend      admin
DELETE /api/disasters/:id             admin
```

### Help requests

```text
POST  /api/help-requests              public
GET   /api/help-requests              admin
PATCH /api/help-requests/:id          admin
```

### Shelters

```text
GET   /api/shelters?lat=&lng=&radius= public
GET   /api/shelters/mine              approved organization
POST  /api/shelters                   approved organization
PATCH /api/shelters/:id               owning organization
GET   /api/shelters/pending           admin
GET   /api/shelters/all               admin
PATCH /api/shelters/:id/review        admin
```

### Organizations

```text
POST  /api/organizations/register     public
GET   /api/organizations              public approved list
GET   /api/organizations/me           organization
GET   /api/organizations/pending      admin
PATCH /api/organizations/:id/verify   admin
```

Admin and organization routes require a JWT access token. The frontend stores the token in local storage after login and sends it as a Bearer token.

### Additional API groups

```text
# Missing people
POST   /api/missing-persons/public
GET    /api/missing-persons/public
GET    /api/missing-persons                 admin
PUT    /api/missing-persons/:id             admin
DELETE /api/missing-persons/:id             admin

# Fundraising
GET    /api/campaigns
GET    /api/campaigns/:id
POST   /api/campaigns/:id/payment-order
POST   /api/campaigns/webhook/razorpay
GET    /api/campaigns/mine                 organization
GET    /api/campaigns/admin/all             admin

# Organization contact threads
POST   /api/contact-threads
GET    /api/contact-threads/mine
GET    /api/contact-threads/mine/:id
POST   /api/contact-threads/mine/:id/messages
GET    /api/contact-threads/organization     organization
GET    /api/contact-threads/organization/:id organization
POST   /api/contact-threads/organization/:id/messages organization
PATCH  /api/contact-threads/organization/:id/status organization

# Organization operations
GET    /api/org/dashboard/stats              organization
GET    /api/org/requests                     organization
GET    /api/org/requests/:id                 organization
POST   /api/org/requests/:id/claim           organization
POST   /api/org/requests/:id/messages        organization
PATCH  /api/org/requests/:id/status          organization
GET    /api/org/missing-persons              organization
POST   /api/org/missing-persons/:id/updates organization
POST   /api/org/missing-persons/:id/escalate organization

# Notifications
GET    /api/notifications                    authenticated user
PUT    /api/notifications/:id/read           authenticated user
PUT    /api/notifications/read-all            authenticated user

# Administration
GET    /api/admin/stats
GET    /api/admin/audit-logs
PATCH  /api/admin/help-requests/:id/assign
```

Most public APIs are rate-limited. Authentication, organization roles, admin roles, verification status, ownership checks, and server-side validation are enforced by the backend; client-side controls are not treated as security boundaries.

## Troubleshooting

### `EADDRINUSE: port 5001`

Another backend process is already running. Do not start a second backend. Check:

```powershell
Invoke-WebRequest http://localhost:5001/api/health
```

### `Port 5174 is in use`

Another Vite process is already running. Use the URL printed by Vite, often `5175`.

### `Could not load disasters`

Check these items:

1. The backend is running.
2. `server/.env` contains a valid `DATABASE_URL`.
3. All schema files were run in order.
4. `schema_stage13.sql` was run after the active-alert code was added.
5. The database contains seed records or records created from the admin page.

### The map shows no records

The map does not load all disasters immediately. Search for a place or click the map first. Then increase the radius to `100 km` if the selected point is far from the records.

### The active-alert count is zero

The count includes only records with status `Current` and an unset or future `active_until` value. Historical demo records are not active alerts.

### Online donations are not configured

Check these items:

1. `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` exist in `server/.env`.
2. `schema_stage18.sql` and `schema_stage19.sql` have been applied.
3. The organization has a valid Razorpay Route linked-account ID in `organizations.razorpay_account_id`.
4. Razorpay can reach `/api/campaigns/webhook/razorpay` over HTTPS.
5. The Razorpay dashboard has the `payment.captured` event enabled and uses the same webhook secret.

The browser must never mark a donation as successful by itself. If Checkout succeeds but the donor list has not changed, inspect the backend webhook logs and Razorpay webhook delivery status. The webhook may be delayed or the payment may still be unsettled.

### Campaign page shows an old donor or total

Campaign totals and confirmed donors are shared server-side. Refreshing the page does not reset them. A campaign detail page polls for updates every 10 seconds. Do not edit totals directly in the browser; investigate the payment status and webhook record instead.

## Important Safety Note

DisasterShield is an early-stage prototype. Some records are demo data, and information may not be complete or current. Always follow official government alerts, emergency services, medical professionals, and local disaster-management authorities.
