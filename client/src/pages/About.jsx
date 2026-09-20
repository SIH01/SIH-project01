import React from "react";
import PublicPageHeader from "../components/PublicPageHeader.jsx";

function AboutCard({ eyebrow, title, children }) {
  return <section className="about-card"><span className="about-eyebrow">{eyebrow}</span><h2>{title}</h2><div className="about-card-copy">{children}</div></section>;
}

export default function About() {
  return (
    <main className="about-shell">
      <PublicPageHeader eyebrow="About DisasterShield" title="Practical information when a disaster makes everything harder to find." description="This project brings disaster records, verified relief organizations, help requests, and shelter information into one place without pretending that a prototype replaces official emergency services." icon="shield" />
      <div className="about-grid">
        <AboutCard eyebrow="Why we built this" title="Information is often scattered when people need it most."><p>During events such as the Assam floods, updates, assistance contacts, location details, and requests for help can live in separate posts, spreadsheets, and agency channels. DisasterShield is an early attempt to make that information easier to explore by place and easier for verified responders to act on.</p></AboutCard>
        <AboutCard eyebrow="How the data works" title="Different sources stay clearly labeled."><p>Historical disaster records can be imported from public databases such as the USGS Earthquake Catalog and reviewed by administrators. Live shelter and relief information comes from organizations whose details are reviewed and approved by DisasterShield admins before it is published. Demo records may still be present while the system is being expanded.</p></AboutCard>
        <AboutCard eyebrow="Map and matching" title="Choose a place, then inspect the nearby picture."><p>The map uses coordinates and great-circle distance to find records around a selected location. Nearby shelter results are limited to approved, active submissions. Help requests are submitted without an account and enter an admin review queue.</p></AboutCard>
        <AboutCard eyebrow="Current status" title="This is an active prototype."><p>DisasterShield is early-stage software under active development. Some workflows, integrations, and records are still demo-quality; alert counts and public data should be checked against official government notices, emergency services, and trusted local organizations.</p></AboutCard>
        <AboutCard eyebrow="Built by" title="Our project team"><p>DisasterShield is built by:</p><p>Pranjal Nath<br />Jabed Akter<br />Arif Uddin<br />Dhruv Gowda<br />Nishat Tasnim<br />Th. Binit Singha</p></AboutCard>
        <AboutCard eyebrow="A clear boundary" title="Use this as a coordination aid."><p>For immediate danger, contact local emergency services and follow official government advisories. DisasterShield helps organize information; it does not verify every report in real time and does not replace professional emergency, medical, or disaster-management guidance.</p></AboutCard>
      </div>
    </main>
  );
}
