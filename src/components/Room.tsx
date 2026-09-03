'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BreakLayer } from '@/components/BreakLayer';
import { EntryLayer } from '@/components/EntryLayer';
import { FocusNote } from '@/components/FocusNote';
import { Wordmark } from '@/components/Wordmark';
import { ChannelInfo } from '@/components/controls/ChannelInfo';
import { FocusTimer } from '@/components/controls/FocusTimer';
import { MusicSelector } from '@/components/controls/MusicSelector';
import { PersonalPresence } from '@/components/controls/PersonalPresence';
import { PlaybackBar } from '@/components/controls/PlaybackBar';
import { PresenceLine } from '@/components/controls/PresenceLine';
import { VolumeControl } from '@/components/controls/VolumeControl';
import { useAudio } from '@/hooks/useAudio';
import { usePresence } from '@/hooks/usePresence';
import { useFocusNote } from '@/hooks/useFocusNote';
import { useIdleDim } from '@/hooks/useIdleDim';
import { useTimer } from '@/hooks/useTimer';
import { CHIME_DURATION_MS, primeChime } from '@/lib/chime';
import { breakSuggestion } from '@/lib/notes';
import { entryPresenceLine } from '@/lib/presence/copy';

/** How long the entry layer takes to dissolve, matching its CSS transition. */
const DISSOLVE_MS = 900;

/** How far the music drops during a break — lowered, never stopped. */
const BREAK_DUCK = 0.35;

/** The extra dip right as the chime rings, so it can be heard over the music. */
const CHIME_DUCK = 0.08;
const CHIME_DUCK_IN = 220;
const CHIME_DUCK_OUT = 900;

export function Room() {
  const [entered, setEntered] = useState(false);
  const [dissolving, setDissolving] = useState(false);

  const audio = useAudio();
  const note = useFocusNote(entered);
  const dimmed = useIdleDim(entered);
  const playButtonRef = useRef<HTMLDivElement>(null);

  const presence = usePresence(entered, audio.state.channel);

  // Set by the dip below and read by the phase effect further down, so the
  // sustained break duck doesn't immediately cancel the chime's fast one —
  // the two are cooperating on the same fade, not competing for it.
  const chimeDuckingRef = useRef(false);
  const onBreakRef = useRef(false);

  // A quick dip under the chime, then back to whatever the room should
  // actually be resting at once it's done ringing.
  const duckForChime = useCallback(() => {
    chimeDuckingRef.current = true;
    void audio.setDuck(CHIME_DUCK, CHIME_DUCK_IN);
    window.setTimeout(() => {
      chimeDuckingRef.current = false;
      void audio.setDuck(onBreakRef.current ? BREAK_DUCK : 1, CHIME_DUCK_OUT);
    }, CHIME_DURATION_MS);
  }, [audio]);

  const timer = useTimer({ onFocusEnded: duckForChime, onBreakEnded: duckForChime });

  const handleEnter = useCallback(() => {
    // Start the audio inside the click handler itself, so the browser sees an
    // unbroken user gesture. This is the first moment sound is allowed at all.
    void audio.enter();
    // Unlock the chime here too. Pressing Start also primes it, but a session
    // restored after a refresh is already running and never passes through
    // Start again — and entering the room is the one gesture every visitor
    // makes before any chime can be due.
    void primeChime();
    setDissolving(true);
    window.setTimeout(() => {
      setEntered(true);
      setDissolving(false);
    }, DISSOLVE_MS);
  }, [audio]);

  // Keyboard visitors should land inside the room rather than back at the top
  // of the document. This has to wait for the render that clears `inert` —
  // focusing an inert subtree silently does nothing. Both the mobile bar and
  // the desktop spread render a play button; focus whichever one is on screen.
  useEffect(() => {
    if (!entered) return;
    const plays = playButtonRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Play music"], button[aria-label="Pause music"]',
    );
    const visible = plays && [...plays].find((b) => b.offsetParent !== null);
    (visible ?? plays?.[0])?.focus();
    note.show();
    // `note.show` is stable and re-running this on every note change would
    // re-show it constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  /** Starting a focus session shows a new note; the music comes back up below. */
  const beginFocus = useCallback(() => {
    timer.start();
    note.show();
  }, [timer, note]);

  const playing = audio.state.status === 'playing';
  const onBreak = timer.session.phase === 'break' || timer.session.phase === 'break-ended';
  onBreakRef.current = onBreak;

  // The music is lowered for the whole of a break and comes back up when the
  // next session begins. Driving this from the phase rather than from the
  // transition event means a break restored after a refresh is also quiet —
  // and that pressing pause and play during a break cannot undo it.
  useEffect(() => {
    // The chime's own dip is already carrying this transition to its resting
    // level; jumping in here too would cancel the dip before it lands.
    if (chimeDuckingRef.current) return;
    void audio.setDuck(onBreak ? BREAK_DUCK : 1);
  }, [onBreak, audio]);

  const suggestion = useMemo(
    () => breakSuggestion(timer.session.breakCount),
    [timer.session.breakCount],
  );

  return (
    <main className="fixed inset-0 h-[100dvh] w-full">
      <div
        className="room-grid transition-opacity duration-[1200ms] ease-[var(--ease-quiet)]"
        style={{ opacity: entered ? 1 : 0 }}
        inert={entered ? undefined : true}
      >
        <div className="area-wordmark" data-dim={dimmed || undefined}>
          <Wordmark />
        </div>

        {/* Bottom left on desktop; the top-right corner on mobile, where the
            bar below has no room for a sentence. */}
        <div className="area-presence" data-dim={dimmed || undefined}>
          <span className="only-desktop">
            <PresenceLine status={presence.status} sessions={presence.snapshot.sessions} />
          </span>
          <span className="only-mobile">
            <PresenceLine status={presence.status} sessions={presence.snapshot.sessions} compact />
          </span>
        </div>

        <div className="area-note">
          {onBreak ? (
            <BreakLayer
              phase={timer.session.phase === 'break' ? 'break' : 'break-ended'}
              remainingMs={timer.remainingMs}
              suggestion={suggestion}
              onBeginAgain={beginFocus}
            />
          ) : (
            <FocusNote text={note.text} visible={note.visible} />
          )}
        </div>

        {/* The controls. On desktop `display: contents` lets each area take its
            own grid slot (music/timer up top, playback/personal along the
            bottom); on mobile the same four collapse into one bottom bar. */}
        <div className="room-controls" ref={playButtonRef}>
          <div className="area-music" data-dim={dimmed || undefined}>
            <span className="only-desktop">
              <MusicSelector
                value={audio.state.channel}
                onChange={(id) => void audio.setChannel(id)}
                info={<ChannelInfo />}
              />
            </span>
            <span className="only-mobile">
              <MusicSelector
                value={audio.state.channel}
                onChange={(id) => void audio.setChannel(id)}
                compact
              />
            </span>
          </div>

          <div className="area-timer" data-dim={dimmed || undefined}>
            <span className="only-desktop">
              <FocusTimer
                session={timer.session}
                remainingMs={timer.remainingMs}
                onStart={beginFocus}
                onPause={timer.pause}
                onResume={timer.resume}
                onReset={timer.reset}
                onPreset={timer.setPreset}
                onCustom={timer.setCustom}
              />
            </span>
            <span className="only-mobile">
              <FocusTimer
                session={timer.session}
                remainingMs={timer.remainingMs}
                onStart={beginFocus}
                onPause={timer.pause}
                onResume={timer.resume}
                onReset={timer.reset}
                onPreset={timer.setPreset}
                onCustom={timer.setCustom}
                compact
              />
            </span>
          </div>

          <div className="area-playback" data-dim={dimmed || undefined}>
            <span className="only-desktop">
              <PlaybackBar
                playing={playing}
                onTogglePlay={() => void audio.toggle()}
                volumeControl={
                  <VolumeControl
                    volume={audio.state.volume}
                    muted={audio.state.muted}
                    onChange={audio.setVolume}
                    onToggleMuted={audio.toggleMuted}
                  />
                }
              />
            </span>
            <span className="only-mobile">
              <PlaybackBar playing={playing} onTogglePlay={() => void audio.toggle()} />
            </span>
          </div>

          {/* Its own slot in the bar on mobile; folded in beside the play
              button on desktop, so this stray copy is hidden there. */}
          <div className="only-mobile">
            <VolumeControl
              volume={audio.state.volume}
              muted={audio.state.muted}
              onChange={audio.setVolume}
              onToggleMuted={audio.toggleMuted}
              compact
            />
          </div>

          <div className="area-personal" data-dim={dimmed || undefined}>
            <span className="only-desktop">
              <PersonalPresence
                activity={presence.own.activity}
                drink={presence.own.drink}
                onChange={presence.setPresence}
                onClear={presence.clearPresence}
              />
            </span>
            <span className="only-mobile">
              <PersonalPresence
                activity={presence.own.activity}
                drink={presence.own.drink}
                onChange={presence.setPresence}
                onClear={presence.clearPresence}
                compact
              />
            </span>
          </div>
        </div>
      </div>

      {!entered && (
        <EntryLayer
          presenceLine={entryPresenceLine(presence.status)}
          leaving={dissolving}
          onEnter={handleEnter}
        />
      )}
    </main>
  );
}
