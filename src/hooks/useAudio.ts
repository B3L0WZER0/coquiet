'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { AudioEngine, type AudioState } from '@/lib/audio-engine';
import { DEFAULT_CHANNEL, isChannelId, type ChannelId } from '@/lib/channels';
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
