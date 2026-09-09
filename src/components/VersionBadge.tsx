'use client';

import { Popover } from '@/components/ui/Popover';
import { COMING_SOON, FEATURE_REQUEST_URL, RELEASES, VERSION } from '@/lib/release';

/** The version line in the entry screen's corner: press it for what's new. */
export function VersionBadge() {
  return (
    <Popover
      label={`Version ${VERSION} — what's new`}
      // A press, not a hover: this is something to read, and a panel that
      // opened on the way past would cover the composition unasked.
      // Opens upward, out of the corner it sits in.
      revealOnHoverAndFocus={false}
      placement="top"
      align="end"
      offset={12}
      className="version-badge"
      triggerClassName="version-chip"
      panelClassName="version-panel"
      panel={<Notes />}
    >
      <span>Version {VERSION}</span>
      <Chevron />
    </Popover>
  );
}

function Notes() {
  return (
    <div className="version-notes">
      <p className="label-quiet">What&rsquo;s new</p>

      {RELEASES.map((release) => (
        <section key={release.version} className="version-release">
          <h3 className="version-release-head">
            <span className="version-release-no">v{release.version}</span>
            <span className="version-release-date">{release.date}</span>
          </h3>
          <ul className="version-release-list">
            {release.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ))}

      {/* Deliberately a different object from the notes above: those happened,
          these have not. Dashed edge, its own tint, no bullets. */}
      <div className="version-soon">
        <p className="label-quiet version-soon-label">
          <SoonMark />
          Coming soon
        </p>
        <ul className="version-soon-list">
          {COMING_SOON.map((item) => (
            <li key={item.title}>
              <span className="version-soon-title">{item.title}</span>
              <span className="version-soon-hint">{item.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <a
        href={FEATURE_REQUEST_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="version-request"
      >
        Request a feature
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path
            d="M3.1 7.9 7.9 3.1M4.2 3.1h3.7v3.7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  );
}

/** The only sign this line is pressable; turns over when the panel is open. */
function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="9"
      height="6"
      viewBox="0 0 9 6"
      fill="none"
      className="version-chip-chevron"
    >
      <path
        d="M1 4.6 4.5 1.1 8 4.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A small unfilled ring — the notes above get solid dots, these do not. */
function SoonMark() {
  return (
    <svg aria-hidden="true" width="9" height="9" viewBox="0 0 9 9" fill="none">
      <circle cx="4.5" cy="4.5" r="3.4" stroke="currentColor" strokeWidth="1.1" opacity="0.75" />
    </svg>
  );
}
