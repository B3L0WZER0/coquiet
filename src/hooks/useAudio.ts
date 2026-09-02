'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { AudioEngine, type AudioState } from '@/lib/audio-engine';
import { DEFAULT_CHANNEL, isChannelId, type ChannelId } from '@/lib/channels';
import { STORAGE_KEYS, readStored, writeStored } from '@/lib/storage';

export const DEFAULT_VOLUME = 0.7;

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

/**
 * The page's one audio engine.
 *
 * There is a single room, so there is a single engine, and it belongs to the
 * page rather than to any component that happens to render. Tying its lifetime
 * to a component would mean React's development double-mount tears it down
 * between the two mounts, leaving a disposed engine behind — and in production
 * it would still be destroyed and rebuilt by any remount, cutting the music.
 *
 * It is created lazily on first use and makes no sound and fetches nothing
 * until `enter()` is called from the visitor's own gesture.
 */
let engine: AudioEngine | null = null;

function getEngine(): AudioEngine | null {
  if (typeof window === 'undefined') return null;
  if (engine === null) engine = new AudioEngine(storedChannel(), storedVolume());
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

  const enter = useCallback(() => getEngine()?.enter(), []);
  const toggle = useCallback(() => getEngine()?.toggle(), []);

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

  return { state, enter, toggle, setChannel, setVolume, setDuck, toggleMuted };
}
