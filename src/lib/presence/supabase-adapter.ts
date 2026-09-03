/** The cross-device presence adapter. */

import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';

import { DEFAULT_CHANNEL, isChannelId } from '@/lib/channels';
import { HEARTBEAT_MS, live } from '@/lib/presence/aggregate';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/presence/config';
import {
  isActivity,
  isDrink,
  type OwnPresence,
  type PresenceProvider,
  type PresenceSession,
  type PresenceSnapshot,
} from '@/lib/presence/types';

/** One room, one channel. */
const ROOM = 'coquiet:room';

/** Reconnect backoff: quick first, then backing off so a dead server isn't
 *  hammered by every open tab. Someone sitting a 50-minute timer out has to be
 *  reconnected without being asked to reload. */
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/** How long a dropped connection keeps serving the room it last saw. Mobile
 *  Safari suspends the socket on every tab switch and lock; without this grace
 *  the presence line blinked out and back on each reconnect. The sessions it
 *  keeps showing are still the real ones, expired by the shared `live()` rule. */
const OFFLINE_GRACE_MS = 40_000;

const SESSION_ID_KEY = 'coquiet:session-id';

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

/** A per-tab anonymous id — the same reasoning as the local adapter. */
function sessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = newId();
    window.sessionStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** What one person publishes about themselves. */
interface Payload {
  id: string;
  activity: string | null;
  drink: string | null;
  channel: string;
  at: number;
}

/** Read someone else's payload defensively. */
function toSession(raw: unknown): PresenceSession | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Partial<Payload>;
  if (typeof p.id !== 'string' || p.id.length === 0) return null;
  return {
    id: p.id,
    activity: isActivity(p.activity) ? p.activity : null,
    drink: isDrink(p.drink) ? p.drink : null,
    channel: isChannelId(p.channel) ? p.channel : DEFAULT_CHANNEL,
    lastSeen: typeof p.at === 'number' ? p.at : Date.now(),
  };
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
  private others = new Map<string, PresenceSession>();
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
    this.id = typeof window === 'undefined' ? 'server' : sessionId();
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
    this.channel = client.channel(ROOM, {
      config: { presence: { key: this.id } },
    });

    this.channel.on('presence', { event: 'sync' }, () => this.readState());

    this.channel.subscribe((status) => {
      this.connected = status === 'SUBSCRIBED';
      if (this.connected) {
        this.everConnected = true;
        this.offlineSince = null;
        this.retryDelay = RETRY_MIN_MS;
        this.clearGraceTimer();
        // Joining before the channel was ready leaves nothing tracked, so the
        // track is (re)issued here as well as in join().
        if (this.joined) void this.track();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // The socket does not always come back on its own: the channel can
        // settle into an error state and stay there. Keep the last known room
        // on screen for the grace window rather than blinking it out — the
        // sessions still expire on their own if the outage outlasts it.
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

  /** Replace what we know with what the server currently reports. */
  private readState(): void {
    if (!this.channel) return;
    const state = this.channel.presenceState();
    this.others.clear();
    for (const entries of Object.values(state)) {
      for (const entry of entries as unknown[]) {
        const session = toSession(entry);
        if (session && session.id !== this.id) this.others.set(session.id, session);
      }
    }
    this.publish();
  }

  private async track(): Promise<void> {
    if (!this.channel || !this.connected) return;
    this.own = { ...this.own, lastSeen: Date.now() };
    const payload: Payload = {
      id: this.id,
      activity: this.own.activity,
      drink: this.own.drink,
      channel: this.own.channel,
      at: this.own.lastSeen,
    };
    try {
      await this.channel.track(payload);
    } catch {
      // The subscribe callback sees the drop and rebuilds the channel; the
      // next beat re-tracks once it is back.
    }
  }

  join(own: OwnPresence): void {
    if (this.joined) return;
    this.own = { ...this.own, ...own, lastSeen: Date.now() };
    this.joined = true;

    this.bindVisibility();
    this.connect();
    void this.track();

    // Keeps `lastSeen` fresh so a connection that has gone quiet without
    // dropping is still expired by the shared rule rather than lingering.
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
      void this.channel?.untrack();
    } catch {
      // Tearing down; the server drops us when the socket closes anyway.
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
    const others = live([...this.others.values()], now);
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
