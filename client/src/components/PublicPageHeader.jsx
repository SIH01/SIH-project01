import React from "react";

const icons = {
  shield: <><path d="M12 3.2 19 6v5.2c0 4.5-2.8 7.9-7 9.6-4.2-1.7-7-5.1-7-9.6V6l7-2.8Z" /><path d="M12 8.2v4.5M12 15.7h.01" /></>,
  map: <><path d="M4.5 5.5 9 3.8l6 2.4 4.5-1.7v13.9L15 20.2l-6-2.4-4.5 1.7V5.5Z" /><path d="M9 3.8v14M15 6.2v14" /></>,
  hand: <><path d="M7.5 11V6.5a1.4 1.4 0 0 1 2.8 0V10m0-1.8V4.8a1.4 1.4 0 0 1 2.8 0V10m0-1.5V6.2a1.4 1.4 0 0 1 2.8 0v4.6m0-1.2V8.8a1.4 1.4 0 0 1 2.8 0v5.1c0 4-2.4 6.3-6.3 6.3h-1.2c-2.1 0-3.7-.8-5-2.5L4 14.9a1.5 1.5 0 0 1 2.4-1.8l1.1 1.2V11Z" /></>,
  megaphone: <><path d="m4 13 12 4V7L4 11v2Z" /><path d="M16 9.5 20 8v8l-4-1.5M7 14l1.5 5H11l-1.2-4.3" /></>,
  building: <><path d="M5 20V5.5L14 3v17M14 8h5v12M3 20h18M8 8h2M8 11h2M8 14h2M16 11h1M16 14h1" /></>,
};

export default function PublicPageHeader({ eyebrow, title, accentWord, description, icon = "shield", action, className = "" }) {
  const resolvedAccentWord = accentWord || title.trim().split(/\s+/).pop();
  const headingParts = resolvedAccentWord && title.includes(resolvedAccentWord) ? title.split(resolvedAccentWord) : [title];
  return (
    <header className={`public-page-header ${className}`.trim()}>
      <div className="public-page-header-inner">
        <div className="public-page-header-copy">
          <p className="public-page-eyebrow">
            <span className="public-page-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">{icons[icon] || icons.shield}</svg>
            </span>
            {eyebrow}
          </p>
          <h1>{headingParts.length === 1 ? title : <>{headingParts[0]}<span className="public-page-heading-accent">{resolvedAccentWord}</span>{headingParts.slice(1).join(resolvedAccentWord)}</>}</h1>
          {description && <p className="public-page-description">{description}</p>}
        </div>
        {action && <div className="public-page-header-action">{action}</div>}
      </div>
    </header>
  );
}
