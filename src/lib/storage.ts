/** Small typed wrapper around localStorage. */

const PREFIX = 'coquiet:';

function available(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function readStored<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  if (!available()) return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed = parse(raw);
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: string): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Quota or private mode — preferences simply do not persist this session.
  }
}

export function removeStored(key: string): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}

export const STORAGE_KEYS = {
  channel: 'channel',
  volume: 'volume',
  timer: 'timer',
  timerPreset: 'timer-preset',
  presence: 'personal-presence',
  sessionId: 'session-id',
} as const;
