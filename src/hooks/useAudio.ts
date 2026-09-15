'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { assetPath } from '@/lib/asset-path';
import { AudioEngine, type AudioState } from '@/lib/audio-engine';
import { DEFAULT_CHANNEL, getChannel, isChannelId, type ChannelId } from '@/lib/channels';
import { setChimeContextSource } from '@/lib/chime';
import { STORAGE_KEYS, readStored, writeStored } from '@/lib/storage';

export const DEFAULT_VOLUME = 0.5;

/** The visitor's remembered channel, or Flow. */
export function storedChannel(): ChannelId {
  return readStored(STORAGE_KEYS.channel, (raw) => (isChannelId(raw) ? raw : null), DEFAULT_CHANNEL);
}

/** The visitor's remembered level, or a comfortable default. */
export function storedVolume(): number {
  return readStored(
    STORAGE_KEYS.volume,
    (raw) => {
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
    },
    DEFAULT_VOLUME,
  );
}

const SERVER_STATE: AudioState = {
  status: 'idle',
  channel: DEFAULT_CHANNEL,
  volume: DEFAULT_VOLUME,
  muted: false,
  switching: false,
};

/** The page's one audio engine. */
let engine: AudioEngine | null = null;

/** Where a hot reload can find the engine the previous module left running.
 *  Development only — the export never hot-reloads. */
const HOT_ENGINE = '__coquietEngine';

function getEngine(): AudioEngine | null {
  if (typeof window === 'undefined') return null;
  if (engine === null) {
    const hot =
      process.env.NODE_ENV !== 'production'
        ? (window as unknown as Record<string, AudioEngine | undefined>)
        : null;
    // A hot reload replaces this module and the engine below with it, but the
    // old engine's audio element carries on playing — now deaf to every
    // control, since pause, volume, channel and the fades around a chime all
    // reach the new one. Stop it before taking over, so what the room sounds
    // like and what it shows cannot disagree.
    hot?.[HOT_ENGINE]?.destroy();
    engine = new AudioEngine(storedChannel(), storedVolume());
    if (hot) hot[HOT_ENGINE] = engine;
    // Let the chime ring through the room's own audio session where there is
    // one, rather than opening a second context iOS will not keep alive.
    setChimeContextSource(() => engine?.sharedContext() ?? null);
  }
  return engine;
}

function subscribe(onChange: () => void): () => void {
  return getEngine()?.subscribe(onChange) ?? (() => {});
}

function getSnapshot(): AudioState {
  return getEngine()?.snapshot() ?? SERVER_STATE;
}

function getServerSnapshot(): AudioState {
  return SERVER_STATE;
}

export function useAudio() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The lock screen's Now Playing card. Left to itself iOS shows the page title
  // and borrows a transparent-cornered icon, which it paints with white corners.
  useEffect(() => {
    if (state.status === 'idle' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: getChannel(state.channel).label,
      artist: 'Coquiet',
      artwork: [{ src: assetPath('/artwork-512.png'), sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = state.status === 'playing' ? 'playing' : 'paused';
  }, [state.status, state.channel]);

  // Lock-screen controls. Play and pause go through the engine, so they fade and
  // a resume rejoins the shared position. Seeking is withdrawn: skipping 10s
  // would put this visitor out of step with everyone else in the room.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // An action this browser doesn't know is fine to skip.
      }
    };
    set('play', () => void getEngine()?.play());
    set('pause', () => void getEngine()?.pause());
    for (const action of ['seekbackward', 'seekforward', 'seekto'] as const) set(action, null);
    return () => {
      set('play', null);
      set('pause', null);
    };
  }, []);

  const enter = useCallback(() => getEngine()?.enter(), []);
  const toggle = useCallback(() => getEngine()?.toggle(), []);
  const retry = useCallback(() => getEngine()?.retry(), []);

  const setChannel = useCallback((id: ChannelId) => {
    writeStored(STORAGE_KEYS.channel, id);
    return getEngine()?.setChannel(id);
  }, []);

  const setVolume = useCallback((v: number) => {
    writeStored(STORAGE_KEYS.volume, String(v));
    getEngine()?.setVolume(v);
  }, []);

  const setDuck = useCallback((level: number, ms?: number) => getEngine()?.setDuck(level, ms), []);

  // Muting is a statement about right now, not a preference, so it is not
  // remembered — every visit starts audible, as "Ambient sound fades in"
  // promises on the way in.
  const toggleMuted = useCallback(() => getEngine()?.toggleMuted(), []);

  return { state, enter, toggle, retry, setChannel, setVolume, setDuck, toggleMuted };
}
