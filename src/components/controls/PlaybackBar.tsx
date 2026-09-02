'use client';

/**
 * Bottom centre: a refined circular play/pause button, with a discreet volume
 * control that expands on hover, focus or tap.
 *
 * Milestone 1 places it; the audio engine behind it arrives in milestone 2.
 */
export function PlaybackBar({
  playing,
  onTogglePlay,
  volumeControl,
}: {
  playing: boolean;
  onTogglePlay?: () => void;
  volumeControl?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? 'Pause music' : 'Play music'}
        className="control-surface flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-[var(--duration-control)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)]"
      >
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </button>
      {volumeControl}
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg width="15" height="17" viewBox="0 0 15 17" aria-hidden="true" fill="currentColor">
      {/* Nudged right by a hair so it reads as optically centred in the circle. */}
      <path d="M14 7.634a1 1 0 0 1 0 1.732L2 16.294a1 1 0 0 1-1.5-.866V1.572A1 1 0 0 1 2 .706z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" fill="currentColor">
      <rect x="1" y="0" width="4" height="16" rx="1.4" />
      <rect x="9" y="0" width="4" height="16" rx="1.4" />
    </svg>
  );
}
