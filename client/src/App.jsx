import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Landing from "./pages/Landing.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import About from "./pages/About.jsx";
import DisasterMap from "./pages/DisasterMap.jsx";
import GetHelp from "./pages/GetHelp.jsx";
import Organizations from "./pages/Organizations.jsx";
import OrganizationLogin from "./pages/OrganizationLogin.jsx";
import ContactOrganization from "./pages/ContactOrganization.jsx";
import MyRequests from "./pages/MyRequests.jsx";
import DirectMessaging from "./pages/DirectMessaging.jsx";
import OrganizationPortal from "./pages/OrganizationPortal.jsx";
import OrganizationProfile from "./pages/OrganizationProfile.jsx";
import RegisterOrganization from "./pages/RegisterOrganization.jsx";
import DisasterDetail from "./pages/DisasterDetail.jsx";
import MissingPersons from "./pages/MissingPersons.jsx";
import Fundraising from "./pages/Fundraising.jsx";
import OrgShelterManager from "./pages/OrgShelterManager.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminDisasterList from "./pages/admin/AdminDisasterList.jsx";
import AdminDisasterForm from "./pages/admin/AdminDisasterForm.jsx";
import AdminAssistanceList from "./pages/admin/AdminAssistanceList.jsx";
import AdminShelters from "./pages/admin/AdminShelters.jsx";
import AdminReliefRequests from "./pages/admin/AdminReliefRequests.jsx";
import AdminOrganizations from "./pages/admin/AdminOrganizations.jsx";
import AdminActiveAlerts from "./pages/admin/AdminActiveAlerts.jsx";
import AdminMissingPersons from "./pages/admin/AdminMissingPersons.jsx";
import AdminCampaigns from "./pages/admin/AdminCampaigns.jsx";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs.jsx";
import OrganizationAuthLayout from "./components/OrganizationAuthLayout.jsx";

export default function App() {
  const location = useLocation();
  const isOrganizationPortal = location.pathname.startsWith("/organization/") || location.pathname.startsWith("/org/");

  return (
    <>
      {!isOrganizationPortal && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/about" element={<About />} />
        <Route path="/map" element={<DisasterMap />} />
        <Route path="/disasters/:id" element={<DisasterDetail />} />
        <Route path="/get-help" element={<GetHelp />} />
        <Route path="/missing-persons" element={<MissingPersons />} />
        <Route path="/fundraising" element={<Fundraising />} />
        <Route path="/fundraising/:campaignId" element={<Fundraising />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/organizations/register" element={<OrganizationAuthLayout><RegisterOrganization /></OrganizationAuthLayout>} />
        <Route path="/organizations/login" element={<OrganizationAuthLayout><OrganizationLogin /></OrganizationAuthLayout>} />
        <Route path="/org/login" element={<OrganizationAuthLayout><OrganizationLogin /></OrganizationAuthLayout>} />
        <Route path="/organization/login" element={<OrganizationAuthLayout><OrganizationLogin /></OrganizationAuthLayout>} />
        <Route path="/organizations/:id/contact" element={<ContactOrganization />} />
        <Route path="/organizations/:id" element={<OrganizationProfile />} />
        <Route path="/my-requests" element={<MyRequests />} />
        <Route path="/messages/:id" element={<DirectMessaging />} />

        <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/disasters" element={<ProtectedRoute role="admin"><AdminDisasterList /></ProtectedRoute>} />
        <Route path="/admin/disasters/new" element={<ProtectedRoute role="admin"><AdminDisasterForm /></ProtectedRoute>} />
        <Route path="/admin/disasters/:id/edit" element={<ProtectedRoute role="admin"><AdminDisasterForm /></ProtectedRoute>} />
        <Route path="/admin/assistance" element={<ProtectedRoute role="admin"><AdminAssistanceList /></ProtectedRoute>} />
        <Route path="/admin/shelters" element={<ProtectedRoute role="admin"><AdminShelters /></ProtectedRoute>} />
        <Route path="/admin/relief-requests" element={<ProtectedRoute role="admin"><AdminReliefRequests /></ProtectedRoute>} />
        <Route path="/admin/organizations" element={<ProtectedRoute role="admin"><AdminOrganizations /></ProtectedRoute>} />
        <Route path="/admin/active-alerts" element={<ProtectedRoute role="admin"><AdminActiveAlerts /></ProtectedRoute>} />
        <Route path="/admin/missing-persons" element={<ProtectedRoute role="admin"><AdminMissingPersons /></ProtectedRoute>} />
        <Route path="/admin/campaigns" element={<ProtectedRoute role="admin"><AdminCampaigns /></ProtectedRoute>} />
        <Route path="/admin/audit-logs" element={<ProtectedRoute role="admin"><AdminAuditLogs /></ProtectedRoute>} />

        <Route path="/organization/dashboard" element={<ProtectedRoute role="organization"><OrganizationPortal /></ProtectedRoute>} />
        <Route path="/org/dashboard" element={<ProtectedRoute role="organization"><OrganizationPortal /></ProtectedRoute>} />
      </Routes>
    </>
  );
}