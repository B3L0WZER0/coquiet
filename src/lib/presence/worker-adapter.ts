/** The cross-device presence adapter: one WebSocket to workers/presence. */

import { DEFAULT_CHANNEL } from '@/lib/channels';
import { expand } from '@/lib/presence/baseline';
import { PRESENCE_URL } from '@/lib/presence/config';
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

/** Keeps the socket from idling out and tells the server we are still here.
 *  The server answers without waking, so this costs nothing there. */
const PING_MS = 30_000;

/** How long a returning tab waits for a pong before calling its socket dead —
 *  iOS can hand back a socket that looks open and isn't. */
const PROBE_MS = 5_000;

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

/** `/presence` resolves against the page, http→ws; a full ws(s):// URL is
 *  used as is (a local `wrangler dev`). */
function socketUrl(): string {
  const url = new URL(PRESENCE_URL, window.location.href);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';
  return url.toString();
}

/** What the server sends: counts, not individual sessions. */
interface Rollup {
  count: number;
  activities: Record<Activity, number>;
  drinks: Record<Exclude<Drink, 'nothing'>, number>;
}

const DRINK_KEYS = DRINKS.filter((d): d is Exclude<Drink, 'nothing'> => d !== 'nothing');

/** Read the rollup defensively — it crossed the network. */
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
 *  bucket counts don't quite add up still yields the right number of sessions. */
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

export class WorkerPresenceAdapter implements PresenceProvider {
  private socket: WebSocket | null = null;
  private id: string;
  private own: PresenceSession;
  private lastRollup: Rollup | null = null;
  private listeners = new Set<(snapshot: PresenceSnapshot) => void>();
  private ping: number | null = null;
  private probe: number | null = null;
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

  /** Connect without announcing. */
  observe(): void {
    if (this.observing || this.joined) return;
    if (typeof window === 'undefined') return;
    this.observing = true;
    this.bindVisibility();
    this.connect();
  }

  private connect(): void {
    if (this.socket) return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl());
    } catch {
      this.markOffline();
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.connected = true;
      this.everConnected = true;
      this.offlineSince = null;
      this.retryDelay = RETRY_MIN_MS;
      this.clearGraceTimer();
      if (this.joined) this.announce();
      this.ping = window.setInterval(() => this.send('ping'), PING_MS);
      this.publish();
    };

    socket.onmessage = (event: MessageEvent) => {
      if (this.socket !== socket) return;
      this.clearProbe();
      if (event.data === 'pong') return;
      try {
        this.lastRollup = parseRollup(JSON.parse(String(event.data)));
      } catch {
        return;
      }
      this.publish();
    };

    // `error` is always followed by `close`, so only `close` acts.
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.dropSocket();
      this.markOffline();
      this.scheduleReconnect();
      this.publish();
    };
  }

  /** Forget the current socket, closing it if it is still up. */
  private dropSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    this.clearProbe();
    if (this.ping !== null) window.clearInterval(this.ping);
    this.ping = null;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = null;
    try {
      socket.close();
    } catch {
      // Already closed.
    }
  }

  private send(data: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(data);
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

  private clearProbe(): void {
    if (this.probe !== null) window.clearTimeout(this.probe);
    this.probe = null;
  }

  /** Open a fresh socket after a drop, backing off between attempts. */
  private scheduleReconnect(): void {
    if (this.retry !== null) return;
    if (!this.observing && !this.joined) return;

    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);

    this.retry = window.setTimeout(() => {
      this.retry = null;
      if (!this.observing && !this.joined) return;
      this.dropSocket();
      this.connect();
    }, delay);
  }

  /** Rebuild `count` synthetic sessions from the last rollup, excluding this
   *  visitor (the server counted them; `own` is appended separately in
   *  `build()` so it reflects instantly rather than on the next rollup). */
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

  private announce(): void {
    this.send(JSON.stringify({ t: 'here', activity: this.own.activity, drink: this.own.drink }));
  }

  join(own: OwnPresence): void {
    if (this.joined) return;
    this.own = { ...this.own, ...own, lastSeen: Date.now() };
    this.joined = true;

    this.bindVisibility();
    this.connect();
    this.announce();
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);

    this.publish();
  }

  /** Set when a hide into the back/forward cache took this visitor out, so a
   *  restore puts them back rather than leaving them watching, uncounted. */
  private rejoinOnShow = false;

  private onPageHide = (event: PageTransitionEvent) => {
    this.rejoinOnShow = event.persisted && this.joined;
    this.leave();
  };

  private onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || !this.rejoinOnShow) return;
    this.rejoinOnShow = false;
    this.join(this.own);
  };

  private visibilityBound = false;

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', this.onVisible);
  }

  /** Coming back to the tab: check the socket survived, and if not, reconnect
   *  now rather than on the slow backoff. */
  private onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (!this.observing && !this.joined) return;
    if (this.connected) {
      if (this.probe !== null) return;
      this.send('ping');
      this.probe = window.setTimeout(() => {
        this.probe = null;
        this.dropSocket();
        this.markOffline();
        this.retryDelay = RETRY_MIN_MS;
        this.scheduleReconnect();
        this.publish();
      }, PROBE_MS);
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
    this.announce();
    this.publish();
  }

  leave(): void {
    if (!this.joined) return;
    this.joined = false;
    this.send(JSON.stringify({ t: 'away' }));
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

  destroy(): void {
    this.leave();
    if (this.retry !== null) window.clearTimeout(this.retry);
    this.retry = null;
    this.retryDelay = RETRY_MIN_MS;
    this.clearGraceTimer();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
      window.removeEventListener('pageshow', this.onPageShow);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisible);
    }
    this.visibilityBound = false;
    this.observing = false;
    this.dropSocket();
    this.listeners.clear();
  }
}
