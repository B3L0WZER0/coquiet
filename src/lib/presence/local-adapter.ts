/** The local presence adapter. */

import { DEFAULT_CHANNEL, isChannelId } from '@/lib/channels';
import { EXPIRY_MS, HEARTBEAT_MS, live } from '@/lib/presence/aggregate';
import {
  isActivity,
  isDrink,
  type OwnPresence,
  type PresenceProvider,
  type PresenceSession,
  type PresenceSnapshot,
} from '@/lib/presence/types';

const CHANNEL_NAME = 'coquiet:presence';
const SESSION_ID_KEY = 'coquiet:session-id';

/** How often expired sessions are swept out. */
const SWEEP_MS = 5_000;

type Message =
  /** "I am here, and this is my state." */
  | { kind: 'here'; session: PresenceSession }
  /** "I have just arrived — everyone please say who you are." */
  | { kind: 'roll-call'; from: string }
  /** "I am leaving." */
  | { kind: 'gone'; id: string };

/** A per-tab anonymous id. */
function sessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = newId();
    window.sessionStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    // Private mode, or storage blocked. An in-memory id still gives correct
    // presence for the life of the tab.
    return newId();
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export class LocalPresenceAdapter implements PresenceProvider {
  private channel: BroadcastChannel | null = null;
  private id: string;
  private own: PresenceSession;
  private others = new Map<string, PresenceSession>();
  private listeners = new Set<(snapshot: PresenceSnapshot) => void>();
  private heartbeat: number | null = null;
  private sweep: number | null = null;
  private observing = false;
  private joined = false;
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

  private get supported(): boolean {
    return typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';
  }

  /** Open the channel and start listening, without announcing anything. */
  observe(): void {
    if (this.observing || this.joined) return;
    if (!this.supported) return;

    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event: MessageEvent<unknown>) => this.receive(event.data);
    this.observing = true;

    this.post({ kind: 'roll-call', from: this.id });
    this.sweep = window.setInterval(() => this.publish(), SWEEP_MS);

    this.publish();
  }

  join(own: OwnPresence): void {
    if (this.joined) return;
    this.own = { ...this.own, ...own, lastSeen: Date.now() };

    if (!this.supported) {
      // No channel: this visitor is still genuinely present, they simply
      // cannot see anyone else. One real session is not a fabricated number.
      this.joined = true;
      this.publish();
      return;
    }

    // Usually already open from observing the entry screen.
    if (!this.channel) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<unknown>) => this.receive(event.data);
    }

    this.joined = true;
    this.announce();
    // Ask anyone already here to reintroduce themselves, so a tab opened second
    // sees the room immediately rather than after their next heartbeat.
    this.post({ kind: 'roll-call', from: this.id });

    this.heartbeat = window.setInterval(() => this.announce(), HEARTBEAT_MS);
    this.sweep ??= window.setInterval(() => this.publish(), SWEEP_MS);

    // A closed or backgrounded-then-killed tab should vanish promptly rather
    // than lingering for the whole expiry window.
    window.addEventListener('pagehide', this.onPageHide);

    this.publish();
  }

  private onPageHide = () => this.leave();

  update(patch: Partial<OwnPresence>): void {
    this.own = { ...this.own, ...patch, lastSeen: Date.now() };
    if (!this.joined) return;
    this.announce();
    this.publish();
  }

  leave(): void {
    if (!this.joined) return;
    this.post({ kind: 'gone', id: this.id });
    this.joined = false;
    this.stopTimers();
    this.publish();
  }

  private announce(): void {
    this.own = { ...this.own, lastSeen: Date.now() };
    this.post({ kind: 'here', session: this.own });
  }

  private post(message: Message): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // The channel closes when the page is being torn down; nothing to do.
    }
  }

  private receive(data: unknown): void {
    const message = parse(data);
    if (!message) return;

    switch (message.kind) {
      case 'here':
        if (message.session.id === this.id) return;
        this.others.set(message.session.id, message.session);
        this.publish();
        return;
      case 'roll-call':
        if (message.from === this.id) return;
        // Reply so the newcomer sees us without waiting a full heartbeat. An
        // observer asks this too, and gets an answer without being added to
        // anybody's count.
        if (this.joined) this.announce();
        return;
      case 'gone':
        if (this.others.delete(message.id)) this.publish();
        return;
    }
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
    if (!this.joined && !this.observing) {
      return { sessions: [], joined: false, available: false };
    }
    const now = Date.now();
    const others = live([...this.others.values()], now);
    // Prune here as well as reporting, so a long-lived tab does not accumulate
    // entries for sessions that ended hours ago.
    for (const [id, session] of this.others) {
      if (now - session.lastSeen >= EXPIRY_MS) this.others.delete(id);
    }
    return {
      // Observers are not in the room, so they are not in its count.
      sessions: this.joined ? [{ ...this.own, lastSeen: now }, ...others] : others,
      joined: this.joined,
      available: true,
    };
  }

  private publish(): void {
    const next = this.build();
    const prev = this.cached;
    if (
      prev.available === next.available &&
      prev.joined === next.joined &&
      sameSessions(prev.sessions, next.sessions)
    ) {
      return;
    }
    this.cached = next;
    for (const fn of this.listeners) fn(next);
  }

  private stopTimers(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    if (this.sweep !== null) window.clearInterval(this.sweep);
    this.heartbeat = null;
    this.sweep = null;
  }

  destroy(): void {
    this.leave();
    this.observing = false;
    this.stopTimers();
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onPageHide);
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
    this.others.clear();
  }
}

/** Compare on the fields the room actually renders. */
function sameSessions(a: readonly PresenceSession[], b: readonly PresenceSession[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].activity !== b[i].activity ||
      a[i].drink !== b[i].drink ||
      a[i].channel !== b[i].channel
    ) {
      return false;
    }
  }
  return true;
}

/** Validate anything arriving over the channel. */
function parse(data: unknown): Message | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;

  if (m.kind === 'roll-call') {
    return typeof m.from === 'string' ? { kind: 'roll-call', from: m.from } : null;
  }

  if (m.kind === 'gone') {
    return typeof m.id === 'string' ? { kind: 'gone', id: m.id } : null;
  }

  if (m.kind === 'here') {
    const s = m.session as Record<string, unknown> | undefined;
    if (!s || typeof s.id !== 'string') return null;
    if (typeof s.lastSeen !== 'number' || !Number.isFinite(s.lastSeen)) return null;
    return {
      kind: 'here',
      session: {
        id: s.id,
        activity: isActivity(s.activity) ? s.activity : null,
        drink: isDrink(s.drink) ? s.drink : null,
        channel: isChannelId(s.channel) ? s.channel : DEFAULT_CHANNEL,
        // Never trust a peer's clock for expiry — stamp it with ours, so a tab
        // with a wrong clock cannot make itself immortal or vanish instantly.
        lastSeen: Date.now(),
      },
    };
  }

  return null;
}
