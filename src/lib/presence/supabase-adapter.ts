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

const SESSION_ID_KEY = 'coquiet:session-id';

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

export class SupabasePresenceAdapter implements PresenceProvider {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private id: string;
  private own: PresenceSession;
  private others = new Map<string, PresenceSession>();
  private listeners = new Set<(snapshot: PresenceSnapshot) => void>();
  private heartbeat: number | null = null;
  private observing = false;
  private joined = false;
  private connected = false;
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
    this.connect();
  }

  private connect(): void {
    if (this.channel) return;

    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 4 } },
    });

    this.channel = this.client.channel(ROOM, {
      config: { presence: { key: this.id } },
    });

    this.channel.on('presence', { event: 'sync' }, () => this.readState());

    this.channel.subscribe((status) => {
      this.connected = status === 'SUBSCRIBED';
      // Joining before the channel was ready leaves nothing tracked, so the
      // track is (re)issued here as well as in join().
      if (this.connected && this.joined) void this.track();
      this.publish();
    });

    this.publish();
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
      // A dropped socket resubscribes on its own; the next beat re-tracks.
    }
  }

  join(own: OwnPresence): void {
    if (this.joined) return;
    this.own = { ...this.own, ...own, lastSeen: Date.now() };
    this.joined = true;

    this.connect();
    void this.track();

    // Keeps `lastSeen` fresh so a connection that has gone quiet without
    // dropping is still expired by the shared rule rather than lingering.
    this.heartbeat = window.setInterval(() => void this.track(), HEARTBEAT_MS);
    window.addEventListener('pagehide', this.onPageHide);

    this.publish();
  }

  private onPageHide = () => this.leave();

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
    // Not connected is not the same as nobody here, and the difference has to
    // survive all the way to the UI.
    if (!this.connected || (!this.joined && !this.observing)) {
      return { sessions: [], joined: false, available: false };
    }
    const now = Date.now();
    const others = live([...this.others.values()], now);
    const sessions = this.joined
      ? [...others, { ...this.own, lastSeen: now }]
      : others;
    return { sessions, joined: this.joined, available: true };
  }

  private publish(): void {
    this.cached = this.build();
    for (const fn of this.listeners) fn(this.cached);
  }

  private stopTimers(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  destroy(): void {
    this.leave();
    this.stopTimers();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
    try {
      void this.channel?.unsubscribe();
      void this.client?.removeAllChannels();
    } catch {
      // Nothing useful to do while tearing down.
    }
    this.channel = null;
    this.client = null;
    this.listeners.clear();
    this.observing = false;
    this.connected = false;
  }
}
