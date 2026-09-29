/**
 * Presence at coquiet.app/presence: one Durable Object holds every visitor's
 * WebSocket. An open socket is the heartbeat, so nothing is written per
 * visitor per tick — the reason this replaced Supabase, whose per-heartbeat
 * egress outgrew the free plan.
 *
 * Observers connect and receive the rollup; a `here` message makes a socket
 * count as a person, `away` makes it an observer again. Sockets hibernate, so
 * an idle room costs no duration.
 */

import { DurableObject } from 'cloudflare:workers';

import { parseMessage, tally } from './tally.js';

const PATH = '/presence';

/** Changes are gathered for this long, then sent as one rollup. */
const SETTLE_MS = 2_000;

/** How often an occupied room re-checks for sockets that went quiet. */
const SWEEP_MS = 60_000;

/** Clients ping every 30s; a hidden tab's timers may slow to once a minute.
 *  Past this, the far end is gone (a phone asleep, a dropped network). */
const STALE_MS = 150_000;

function allowedOrigin(origin) {
  if (!origin) return false;
  if (origin === 'https://coquiet.app') return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== PATH) {
      return new Response('Not found', { status: 404 });
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    // Stops other sites opening the room from a visitor's browser; a script
    // can still forge it, which is fine — it only ever sees counts.
    if (!allowedOrigin(request.headers.get('Origin'))) {
      return new Response('Forbidden', { status: 403 });
    }
    return env.ROOM.get(env.ROOM.idFromName('room')).fetch(request);
  },
};

export class Room extends DurableObject {
  /** The last rollup sent; lost on hibernation, which only costs a resend. */
  lastSent = '';

  constructor(ctx, env) {
    super(ctx, env);
    // Answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch() {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ status: null, at: Date.now() });
    server.send(this.rollup());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const status = parseMessage(message);
    if (status === undefined) return;
    ws.serializeAttachment({ status, at: Date.now() });
    await this.settle();
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      // Already closed.
    }
    await this.settle();
  }

  async webSocketError() {
    await this.settle();
  }

  async alarm() {
    this.sweep();
    const next = this.rollup();
    if (next !== this.lastSent) {
      this.lastSent = next;
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(next);
        } catch {
          // Closing; the sweep or its close event takes it out.
        }
      }
    }
    if (this.ctx.getWebSockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
    }
  }

  /** Bring the next rollup forward, unless one is already that close. */
  async settle() {
    const due = Date.now() + SETTLE_MS;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > due) await this.ctx.storage.setAlarm(due);
  }

  /** Close sockets whose last sign of life is older than STALE_MS. */
  sweep() {
    const cutoff = Date.now() - STALE_MS;
    for (const ws of this.ctx.getWebSockets()) {
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      const spoke = ws.deserializeAttachment()?.at ?? 0;
      if (Math.max(pinged, spoke) < cutoff) {
        try {
          ws.close(1001, 'stale');
        } catch {
          // Already gone.
        }
      }
    }
  }

  rollup() {
    const live = this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === WebSocket.OPEN)
      .map((ws) => ws.deserializeAttachment()?.status ?? null);
    return JSON.stringify(tally(live));
  }
}
