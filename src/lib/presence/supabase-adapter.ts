/** The cross-device presence adapter. */

import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';

import { DEFAULT_CHANNEL } from '@/lib/channels';
import { HEARTBEAT_MS } from '@/lib/presence/aggregate';
import { expand } from '@/lib/presence/baseline';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/presence/config';
import { documentSessionId } from '@/lib/presence/session-id';
import {
  ACTIVITIES,
  DRINKS,
  type Activity,
  type Drink,
  type OwnPresence,
  type PresenceProvider,
  type PresenceSession,
  type PresenceSnapshot,
} from '@/lib/presence/types';

/** One room, one channel — carries the rollup broadcast, nothing else. */
const ROOM = 'coquiet:room';

/** The event a rollup tick broadcasts on `ROOM`. Matches the Postgres
 *  function in supabase/migrations/0001_presence_rollup.sql. */
const ROLLUP_EVENT = 'pulse';

/** Reconnect backoff: quick first, then backing off so a dead server isn't
 *  hammered by every open tab. Someone sitting a 50-minute timer out has to be
 *  reconnected without being asked to reload. */
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/** How long a dropped connection keeps serving the room it last saw. Mobile
 *  Safari suspends the socket on every tab switch and lock; without this grace
 *  the presence line blinked out and back on each reconnect. The sessions it
 *  keeps showing are still the real ones, from the last rollup received. */
const OFFLINE_GRACE_MS = 40_000;

/** One Supabase client for the page, not one per adapter or per reconnect —
 *  each `createClient` spins up its own auth client against the same storage
 *  key, which the SDK warns about and which churns the realtime socket. */
let sharedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!sharedClient) {
    sharedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 4 } },
    });
  }
  return sharedClient;
}

/** One row this visitor keeps upserted in `presence_sessions` while joined.
 *  A scheduled Postgres job aggregates the table and broadcasts the rollup —
 *  no client ever reads this table directly. */
interface SessionRow {
  id: string;
  activity: Activity | null;
  drink: Drink | null;
  channel: string;
  last_seen: string;
}

/** What one rollup tick broadcasts: counts, not individual sessions. */
interface Rollup {
  count: number;
  activities: Record<Activity, number>;
  drinks: Record<Exclude<Drink, 'nothing'>, number>;
}

const DRINK_KEYS = DRINKS.filter((d): d is Exclude<Drink, 'nothing'> => d !== 'nothing');

/** Read the rollup broadcast defensively — it crossed the network too. */
function parseRollup(raw: unknown): Rollup | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.count !== 'number') return null;

  const num = (v: unknown): number => (typeof v === 'number' && v > 0 ? v : 0);
  const activities = (typeof p.activities === 'object' && p.activities !== null
    ? (p.activities as Record<string, unknown>)
    : {});
  const drinks = (typeof p.drinks === 'object' && p.drinks !== null
    ? (p.drinks as Record<string, unknown>)
    : {});

  return {
    count: Math.max(0, p.count),
    activities: Object.fromEntries(ACTIVITIES.map((a) => [a, num(activities[a])])) as Record<
      Activity,
      number
    >,
    drinks: Object.fromEntries(DRINK_KEYS.map((d) => [d, num(drinks[d])])) as Record<
      Exclude<Drink, 'nothing'>,
      number
    >,
  };
}

/** Pad or trim a reconstructed list to exactly `length`, so a rollup whose
 *  bucket counts don't quite add up (a race between the sweep and a fresh
 *  heartbeat) still yields the right number of sessions. */
function fitToLength<T>(list: T[], length: number, fill: T): T[] {
  if (list.length >= length) return list.slice(0, length);
  return [...list, ...Array<T>(length - list.length).fill(fill)];
}

/** Compare on the fields the room actually renders, so a sync that changed
 *  nothing visible does not re-render every control. */
function sameSnapshot(a: PresenceSnapshot, b: PresenceSnapshot): boolean {
  if (a.available !== b.available || a.joined !== b.joined) return false;
  if (a.sessions.length !== b.sessions.length) return false;
  for (let i = 0; i < a.sessions.length; i++) {
    const x = a.sessions[i];
    const y = b.sessions[i];
    if (x.id !== y.id || x.activity !== y.activity || x.drink !== y.drink || x.channel !== y.channel) {
      return false;
    }
  }
  return true;
}

export class SupabasePresenceAdapter implements PresenceProvider {
  private channel: RealtimeChannel | null = null;
  private id: string;
  private own: PresenceSession;
  private lastRollup: Rollup | null = null;
  private listeners = new Set<(snapshot: PresenceSnapshot) => void>();
  private heartbeat: number | null = null;
  private retry: number | null = null;
  private retryDelay = RETRY_MIN_MS;
  private graceTimer: number | null = null;
  private observing = false;
  private joined = false;
  private connected = false;
  private everConnected = false;
  private offlineSince: number | null = null;
  private cached: PresenceSnapshot = { sessions: [], joined: false, available: false };

  constructor() {
    this.id = typeof window === 'undefined' ? 'server' : documentSessionId();
    this.own = {
      id: this.id,
      activity: null,
      drink: null,
      channel: DEFAULT_CHANNEL,
      lastSeen: 0,
    };
  }

  /** Subscribe without tracking. */
  observe(): void {
    if (this.observing || this.joined) return;
    if (typeof window === 'undefined') return;
    this.observing = true;
    this.bindVisibility();
    this.connect();
  }

  private connect(): void {
    if (this.channel) return;

    const client = getClient();
    this.channel = client.channel(ROOM);

    this.channel.on('broadcast', { event: ROLLUP_EVENT }, ({ payload }: { payload: unknown }) => {
      this.lastRollup = parseRollup(payload);
      this.publish();
    });

    this.channel.subscribe((status) => {
      this.connected = status === 'SUBSCRIBED';
      if (this.connected) {
        this.everConnected = true;
        this.offlineSince = null;
        this.retryDelay = RETRY_MIN_MS;
        this.clearGraceTimer();
        // Reconnecting doesn't lose the heartbeat interval, but re-announcing
        // now rather than waiting for the next tick keeps the row fresh.
        if (this.joined) void this.track();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // The socket does not always come back on its own: the channel can
        // settle into an error state and stay there. Keep the last known room
        // on screen for the grace window rather than blinking it out — the
        // rollup catches up once a new one arrives.
        this.markOffline();
        this.scheduleReconnect();
      }
      this.publish();
    });

    this.publish();
  }

  /** Note when a live connection first dropped, and arm the timer that retires
   *  the room once the grace window is spent. */
  private markOffline(): void {
    if (this.offlineSince === null) this.offlineSince = Date.now();
    if (this.graceTimer === null) {
      this.graceTimer = window.setTimeout(() => {
        this.graceTimer = null;
        this.publish();
      }, OFFLINE_GRACE_MS);
    }
  }

  private clearGraceTimer(): void {
    if (this.graceTimer !== null) window.clearTimeout(this.graceTimer);
    this.graceTimer = null;
  }

  /** Rebuild the channel after a drop, backing off between attempts. */
  private scheduleReconnect(): void {
    if (this.retry !== null) return;
    if (!this.observing && !this.joined) return;

    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);

    this.retry = window.setTimeout(() => {
      this.retry = null;
      if (!this.observing && !this.joined) return;
      // A channel left in an error state will not resubscribe, so it is thrown
      // away and a fresh one built in its place. The client is kept — only the
      // channel is rebuilt.
      try {
        if (this.channel) getClient().removeChannel(this.channel);
      } catch {
        // Already gone; the replacement below is what matters.
      }
      this.channel = null;
      this.connect();
    }, delay);
  }

  /** Rebuild `count` synthetic sessions from the last rollup, excluding this
   *  visitor's own row (the server counted it; `own` is appended separately
   *  in `build()` so it reflects instantly rather than on the next tick). */
  private othersFromRollup(now: number): PresenceSession[] {
    const rollup = this.lastRollup;
    if (!rollup) return [];

    const activities = { ...rollup.activities };
    const drinks = { ...rollup.drinks };
    let total = rollup.count;

    if (this.joined) {
      total = Math.max(0, total - 1);
      const a = this.own.activity;
      if (a && activities[a] > 0) activities[a] -= 1;
      const d = this.own.drink;
      if (d && d !== 'nothing' && drinks[d] > 0) drinks[d] -= 1;
    }

    const activityList = fitToLength(
      expand(ACTIVITIES, ACTIVITIES.map((a) => activities[a])),
      total,
      null,
    );
    const drinkList = fitToLength(
      expand(DRINK_KEYS, DRINK_KEYS.map((d) => drinks[d])),
      total,
      null,
    );

    return Array.from({ length: total }, (_, i) => ({
      id: `rollup-${i}`,
      activity: activityList[i],
      drink: drinkList[i],
      channel: DEFAULT_CHANNEL,
      lastSeen: now,
    }));
  }

  private async track(): Promise<void> {
    this.own = { ...this.own, lastSeen: Date.now() };
    const row: SessionRow = {
      id: this.id,
      activity: this.own.activity,
      drink: this.own.drink,
      channel: this.own.channel,
      last_seen: new Date(this.own.lastSeen).toISOString(),
    };
    try {
      await getClient().from('presence_sessions').upsert(row);
    } catch {
      // The next heartbeat retries; the row is stale, not wrong.
    }
  }

  join(own: OwnPresence): void {
    if (this.joined) return;
    this.own = { ...this.own, ...own, lastSeen: Date.now() };
    this.joined = true;

    this.bindVisibility();
    this.connect();
    void this.track();

    // Keeps the row fresh so the next rollup still counts this session,
    // rather than sweeping it out for having gone quiet.
    this.heartbeat = window.setInterval(() => void this.track(), HEARTBEAT_MS);
    window.addEventListener('pagehide', this.onPageHide);

    this.publish();
  }

  private onPageHide = () => this.leave();

  private visibilityBound = false;

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', this.onVisible);
  }

  /** Coming back to the tab: re-announce at once and, if the socket died while
   *  we were away, get a reconnect moving now rather than on the slow backoff. */
  private onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (!this.observing && !this.joined) return;
    if (this.connected) {
      if (this.joined) void this.track();
      return;
    }
    if (this.retry !== null) {
      window.clearTimeout(this.retry);
      this.retry = null;
    }
    this.retryDelay = RETRY_MIN_MS;
    this.scheduleReconnect();
  };

  update(patch: Partial<OwnPresence>): void {
    this.own = { ...this.own, ...patch, lastSeen: Date.now() };
    if (!this.joined) return;
    void this.track();
    this.publish();
  }

  leave(): void {
    if (!this.joined) return;
    this.joined = false;
    this.stopTimers();
    try {
      void getClient().from('presence_sessions').delete().eq('id', this.id);
    } catch {
      // Tearing down; the row expires via the next rollup sweep anyway.
    }
    this.publish();
  }

  subscribe(fn: (snapshot: PresenceSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.cached);
    return () => this.listeners.delete(fn);
  }

  snapshot(): PresenceSnapshot {
    return this.cached;
  }

  private build(): PresenceSnapshot {
    const watching = this.joined || this.observing;
    const offlineFor = this.offlineSince === null ? 0 : Date.now() - this.offlineSince;
    const usable = this.everConnected && offlineFor < OFFLINE_GRACE_MS;

    // Not connected is not the same as nobody here — but a long outage is, and
    // the difference has to survive all the way to the UI.
    if (!watching || !usable) {
      return { sessions: [], joined: false, available: false };
    }
    const now = Date.now();
    const others = this.othersFromRollup(now);
    const sessions = this.joined ? [...others, { ...this.own, lastSeen: now }] : others;
    return { sessions, joined: this.joined, available: true };
  }

  private publish(): void {
    const next = this.build();
    if (sameSnapshot(this.cached, next)) return;
    this.cached = next;
    for (const fn of this.listeners) fn(next);
  }

  private stopTimers(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  /** Only on teardown — leaving the room still leaves an observer watching. */
  private stopRetry(): void {
    if (this.retry !== null) window.clearTimeout(this.retry);
    this.retry = null;
    this.retryDelay = RETRY_MIN_MS;
  }

  destroy(): void {
    this.leave();
    this.stopTimers();
    this.stopRetry();
    this.clearGraceTimer();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisible);
    }
    this.visibilityBound = false;
    try {
      if (this.channel) getClient().removeChannel(this.channel);
    } catch {
      // Nothing useful to do while tearing down.
    }
    this.channel = null;
    this.listeners.clear();
    this.observing = false;
    this.connected = false;
  }
}
