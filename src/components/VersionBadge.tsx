'use client';

import { useState } from 'react';

import { Popover } from '@/components/ui/Popover';
import { COMING_SOON, featureRequestDraft, RELEASES, VERSION } from '@/lib/release';

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
      panel={<Panel />}
    >
      <span>Version {VERSION}</span>
      <Chevron />
    </Popover>
  );
}

/** Two faces, one at a time: the notes are read, the form is written. Stacking
 *  them made a panel taller than the space above the corner it opens from.
 *  State lives here rather than in the badge so closing the panel forgets it. */
function Panel() {
  const [writing, setWriting] = useState(false);
  return writing ? <RequestForm onBack={() => setWriting(false)} /> : <Notes onWrite={() => setWriting(true)} />;
}

function Notes({ onWrite }: { onWrite: () => void }) {
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

      <button type="button" onClick={onWrite} className="version-request">
        Request a feature
      </button>
    </div>
  );
}

/** Composes a mail draft. Nothing is sent from here and nothing is stored —
 *  the visitor's own mail app gets the message, and they press send. */
function RequestForm({ onBack }: { onBack: () => void }) {
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState('');
  const [opened, setOpened] = useState(false);

  return (
    <form
      className="version-form"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = featureRequestDraft(summary, detail);
        setOpened(true);
      }}
    >
      <button type="button" onClick={onBack} className="version-back">
        <BackMark />
        What&rsquo;s new
      </button>

      <p className="label-quiet">Request a feature</p>

      <label className="version-field">
        <span>In a few words</span>
        <input
          type="text"
          value={summary}
          maxLength={80}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="A longer break timer"
        />
      </label>

      <label className="version-field">
        <span>What would make Coquiet better?</span>
        <textarea
          rows={3}
          required
          value={detail}
          maxLength={1200}
          onChange={(e) => setDetail(e.target.value)}
        />
      </label>

      <div className="version-form-foot">
        <button type="submit" className="version-send">
          Write the email
        </button>
        <p>
          {opened
            ? 'Your mail app should be opening — the message is ready to send.'
            : 'Opens your own mail app. Nothing is sent from this page.'}
        </p>
      </div>
    </form>
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

function BackMark() {
  return (
    <svg aria-hidden="true" width="11" height="9" viewBox="0 0 11 9" fill="none">
      <path
        d="M10 4.5H1.6m3.3-3.4L1.4 4.5l3.5 3.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
