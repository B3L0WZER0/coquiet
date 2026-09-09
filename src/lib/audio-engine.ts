/** The audio engine. */

import { audioIsOffOrigin } from '@/lib/asset-path';
import {
  getChannel,
  stationPosition,
  type Channel,
  type ChannelId,
  type StationPosition,
} from '@/lib/channels';

export const FADE = {
  /** First sound after entering the room. */
  entry: 4000,
  /** Play and pause. */
  playPause: 1000,
  /** Moving between channels, as a handover rather than a blend. */
  channelOut: 800,
  channelIn: 1600,
  /** How much of the outgoing tail the incoming piece shares. */
  channelOverlap: 350,
  /** One piece giving way to the next inside a channel. The pieces cannot
   *  overlap without the room drifting off the shared clock, so the ending
   *  recedes and the next one emerges either side of the programme's own
   *  boundary. */
  trackOut: 6000,
  trackIn: 5000,
  /** Lowering and restoring music around a break. */
  duck: 1500,
} as const;

/** How often the audible deck's remaining time is checked. */
const TAIL_TICK_MS = 500;

/** How far before the end of a piece the next one starts loading. Generous:
 *  the point is that the boundary is never waiting on the network. */
const TAIL_LEAD_MS = 20_000;

/** How long a segue waits for the next piece before letting the boundary go.
 *  Comfortably inside the lead, so the plain step still has room to run. */
const TAIL_LOAD_MS = 10_000;

export type AudioStatus = 'idle' | 'playing' | 'paused' | 'blocked' | 'error';

export interface AudioState {
  status: AudioStatus;
  channel: ChannelId;
  volume: number;
  muted: boolean;
  /** True while a crossfade is in flight. */
  switching: boolean;
}

interface Deck {
  el: HTMLAudioElement;
  /** 0..1 ramp factor owned by the current fade. */
  fade: number;
  /** Cancels the ramp currently running on this deck, if any. */
  cancel: (() => void) | null;
  /** Which piece this deck currently holds. */
  loaded: { channel: ChannelId; trackIndex: number } | null;
  /** Web Audio routing (el → source → gain → destination), once the deck has
   *  played. Absent when Web Audio is unavailable — then the fade falls back to
   *  `el.volume`, which iOS ignores. */
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
}

export class AudioEngine {
  private decks: [Deck, Deck];
  private activeIndex: 0 | 1 = 0;

  private base: number;
  private muted = false;
  private duck = 1;
  private duckCancel: (() => void) | null = null;

  private status: AudioStatus = 'idle';
  private channelId: ChannelId;
  private switching = false;

  /** The tail watcher, and a token that anything taking a deck over bumps so
   *  a segue already in flight knows to let go. */
  private tailHandle: number | null = null;
  private segueToken = 0;
  private segueing = false;
  /** The piece whose boundary a segue already tried and failed to carry. Held
   *  so the watcher cannot keep re-trying, which would suppress `ended` — the
   *  fallback — for as long as it kept failing. */
  private gaveUpOn: string | null = null;

  private listeners = new Set<(state: AudioState) => void>();
  private disposed = false;

  /** One context for both decks, built the first time sound is asked for. */
  private ctx: AudioContext | null = null;

  /** Cached immutable view of the state above. */
  private cached: AudioState;

  constructor(channel: ChannelId, volume: number) {
    this.channelId = channel;
    this.base = clamp01(volume);
    this.decks = [this.createDeck(), this.createDeck()];
    this.cached = this.build();
  }

  private build(): AudioState {
    return {
      status: this.status,
      channel: this.channelId,
      volume: this.base,
      muted: this.muted,
      switching: this.switching,
    };
  }

  private createDeck(): Deck {
    const el = typeof Audio !== 'undefined' ? new Audio() : ({} as HTMLAudioElement);
    if (el instanceof HTMLAudioElement) {
      // Nothing is fetched until a source is assigned and load() is called.
      el.preload = 'none';
      // The graph is where the level is shaped, so an off-origin file has to be
      // fetched in a form the graph may read. Without this it is tainted and
      // plays silence with no error anywhere; with it, a proxy that strips the
      // header fails loudly instead, as a load error the room can report.
      if (audioIsOffOrigin && hasWebAudio()) el.crossOrigin = 'anonymous';
      el.volume = 0;
      el.addEventListener('error', () => {
        // A deck failing is only fatal if it is the one we are listening to.
        if (this.decks[this.activeIndex]?.el === el && this.status === 'playing') {
          this.setStatus('error');
        }
      });
      el.addEventListener('ended', () => {
        // A piece finished. Rather than stepping to "the next track", ask the
        // station clock again — it has already moved on, and asking it keeps a
        // deck that stalled or drifted from compounding the error.
        if (this.decks[this.activeIndex]?.el !== el) return;
        if (this.status !== 'playing') return;
        // A segue is already carrying this boundary, gently. Only a piece that
        // ran out unattended — a stall, or a file too short to watch — lands here.
        if (this.segueing) return;
        void this.advance();
      });
    }
    return { el, fade: 0, cancel: null, loaded: null, source: null, gain: null };
  }

  // --- web audio ---------------------------------------------------------

  /**
   * Build the context, which is where every level in the room is shaped.
   *
   * There is no detection here on purpose. `HTMLMediaElement.volume` is a
   * request the browser may ignore, and a phone that ignores it does so in the
   * worst possible way: the setter accepts the value, the getter reads it back,
   * and the output never moves. Two gates were tried — an iOS user agent, then
   * a probe that set the property and read it back — and a phone sailed through
   * both while still cutting. Nothing observable distinguishes that phone from
   * a desktop, so the room stops guessing and shapes the level in the graph
   * everywhere. `el.volume` survives only as the fallback below, for a browser
   * with no Web Audio at all.
   */
  private ensureContext(): void {
    if (this.ctx || typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      null;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
  }

  /** Get the context running. Must be reached from inside a user gesture —
   *  enter() and play() both are. */
  private unlock(): void {
    this.ensureContext();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  /** Route a deck into the graph the first time it plays. Deferred to here,
   *  rather than done up front, because on iOS a source node created before its
   *  element has a source can stay silent. Each element can be tapped only
   *  once, so this is a no-op on later plays. */
  private route(deck: Deck): void {
    if (deck.source || !this.ctx || !(deck.el instanceof HTMLAudioElement)) return;
    try {
      const source = this.ctx.createMediaElementSource(deck.el);
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(this.ctx.destination);
      // The element feeds the graph now; its own volume stays wide open so the
      // GainNode is the only thing shaping the level.
      deck.el.volume = 1;
      deck.source = source;
      deck.gain = gain;
    } catch {
      // Leave this deck on el.volume; the other may still route.
    }
  }

  /** The room's context, where one exists — currently iOS only. Shared so the
   *  chime can ring through the same audio session as the music rather than
   *  opening its own, which iOS silences with the ring switch. */
  sharedContext(): AudioContext | null {
    return this.ctx;
  }

  // --- subscription -------------------------------------------------------

  subscribe(fn: (state: AudioState) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot(): AudioState {
    return this.cached;
  }

  /** Publish the current state. */
  private emit() {
    const next = this.build();
    const prev = this.cached;
    if (
      prev.status === next.status &&
      prev.channel === next.channel &&
      prev.volume === next.volume &&
      prev.muted === next.muted &&
      prev.switching === next.switching
    ) {
      return;
    }
    this.cached = next;
    for (const fn of this.listeners) fn(next);
  }

  private setStatus(status: AudioStatus) {
    if (this.status === status) return;
    this.status = status;
    if (status === 'playing') this.watchTail();
    else this.releaseDecks();
    this.emit();
  }

  /** Stop watching for the end of a piece, and tell any segue in flight that
   *  something else now owns the decks. */
  private releaseDecks() {
    if (this.tailHandle !== null) {
      window.clearInterval(this.tailHandle);
      this.tailHandle = null;
    }
    this.segueToken++;
    this.segueing = false;
    this.gaveUpOn = null;
  }

  // --- volume -------------------------------------------------------------

  /** The visitor's chosen level. */
  setVolume(v: number) {
    this.base = clamp01(v);
    if (this.base > 0) this.muted = false;
    this.applyAll();
    this.emit();
  }

  getVolume(): number {
    return this.base;
  }

  /** Silence the room without forgetting how loud it was. */
  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    this.applyAll();
    this.emit();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Lower the music without stopping it — used for breaks. */
  setDuck(level: number, durationMs: number = FADE.duck): Promise<void> {
    this.duckCancel?.();
    const from = this.duck;
    const to = clamp01(level);
    if (Math.abs(from - to) < 0.001) return Promise.resolve();
    return new Promise((resolve) => {
      this.duckCancel = ramp(durationMs, (t) => {
        this.duck = from + (to - from) * t;
        this.applyAll();
      }, () => {
        this.duck = to;
        this.applyAll();
        this.duckCancel = null;
        resolve();
      });
    });
  }

  private applyAll() {
    for (const deck of this.decks) this.apply(deck);
  }

  private apply(deck: Deck) {
    if (!(deck.el instanceof HTMLAudioElement)) return;
    const level = this.muted ? 0 : clamp01(this.base * deck.fade * this.duck);
    if (deck.gain) {
      // Our own ramp() is already stepping this; a plain assignment per step
      // matches what the element-volume path did.
      deck.gain.gain.value = level;
    } else {
      deck.el.volume = level;
    }
  }

  // --- playback -----------------------------------------------------------

  private get active(): Deck {
    return this.decks[this.activeIndex];
  }

  private get idle(): Deck {
    return this.decks[this.activeIndex === 0 ? 1 : 0];
  }

  /** Point a deck at a channel and move it to the channel's current shared
   *  position — or, when `target` is given, to that exact spot instead. */
  private prepare(deck: Deck, channel: Channel, target?: StationPosition): Promise<boolean> {
    const el = deck.el;
    if (!(el instanceof HTMLAudioElement)) return Promise.resolve(true);

    const at = target ?? stationPosition(channel);

    if (deck.loaded?.channel !== channel.id || deck.loaded.trackIndex !== at.trackIndex) {
      el.src = at.track.src;
      deck.loaded = { channel: channel.id, trackIndex: at.trackIndex };
      el.preload = 'auto';
      el.load();
    }

    const seek = () => {
      // Always recompute: the station has moved on while we were loading, and
      // may even have crossed into the next piece.
      try {
        if (target) {
          el.currentTime = target.offsetSeconds;
          return;
        }
        const now = stationPosition(channel);
        el.currentTime = now.trackIndex === at.trackIndex ? now.offsetSeconds : at.offsetSeconds;
      } catch {
        // Seeking before metadata is ready throws in some browsers; the
        // readyState guard below means we only get here when it is safe.
      }
    };

    if (el.readyState >= 1 /* HAVE_METADATA */) {
      seek();
      return Promise.resolve(true);
    }

    // Whether the file actually arrived. A network that filters this origin
    // answers with a page instead of audio, and the element reports that the
    // same way it reports a missing file — so the caller has to be told, or
    // the room goes quiet with nothing to show for it.
    return new Promise<boolean>((resolve) => {
      const settle = (ok: boolean) => () => {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onFailed);
        if (ok) seek();
        resolve(ok);
      };
      const onLoaded = settle(true);
      const onFailed = settle(false);
      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('error', onFailed);
    });
  }

  /** Move the audible deck on to whatever the station is playing now. */
  private async advance(): Promise<void> {
    if (this.disposed) return;
    const deck = this.active;
    const channel = getChannel(this.channelId);

    const loaded = await this.prepare(deck, channel);
    if (this.disposed || this.status !== 'playing') return;
    // The piece that was playing has ended and its successor will not load.
    // Silence either way; say which kind it is.
    if (!loaded) {
      this.setStatus('error');
      return;
    }

    this.route(deck);
    try {
      await deck.el.play();
    } catch {
      this.setStatus('blocked');
    }
  }

  // --- segue --------------------------------------------------------------

  /** Keep an eye on how much of the audible piece is left. */
  private watchTail() {
    if (this.tailHandle !== null || typeof window === 'undefined') return;
    this.tailHandle = window.setInterval(() => this.checkTail(), TAIL_TICK_MS);
  }

  private remainingMs(deck: Deck): number | null {
    const el = deck.el;
    if (!(el instanceof HTMLAudioElement)) return null;
    // Unknown until metadata arrives, and infinite for a stream.
    if (!Number.isFinite(el.duration) || el.duration <= 0) return null;
    return (el.duration - el.currentTime) * 1000;
  }

  /** Which piece a deck is holding, as something comparable. */
  private deckKey(deck: Deck): string | null {
    return deck.loaded ? `${deck.loaded.channel}:${deck.loaded.trackIndex}` : null;
  }

  private checkTail() {
    if (this.disposed || this.segueing || this.switching) return;
    if (this.status !== 'playing') return;
    const remaining = this.remainingMs(this.active);
    if (remaining === null || remaining > TAIL_LEAD_MS) return;
    if (this.gaveUpOn !== null && this.gaveUpOn === this.deckKey(this.active)) return;
    void this.segue();
  }

  /**
   * Carry the programme across a boundary. The ending piece recedes over its
   * last seconds and the next one opens from silence — the switch itself still
   * happens where the station clock says it does, so a long listen never drifts
   * away from someone who has just walked in.
   */
  private async segue(): Promise<void> {
    const token = ++this.segueToken;
    this.segueing = true;
    const mine = () => !this.disposed && this.segueToken === token && this.status === 'playing';

    try {
      const outgoing = this.active;
      const incoming = this.idle;
      const channel = getChannel(this.channelId);
      const index = outgoing.loaded?.trackIndex ?? stationPosition(channel).trackIndex;
      const nextIndex = (index + 1) % channel.tracks.length;
      const next: StationPosition = {
        trackIndex: nextIndex,
        track: channel.tracks[nextIndex],
        offsetSeconds: 0,
      };

      // Load it now, while there is still music playing over the wait. Give up
      // if it will not come: `ended` is the fallback for a boundary this misses,
      // and it stands aside for as long as a segue is in hand. The watcher will
      // try again on its next tick.
      const ready = await withTimeout(this.prepare(incoming, channel, next), TAIL_LOAD_MS);
      if (!ready) {
        this.gaveUpOn = this.deckKey(outgoing);
        return;
      }
      if (!mine()) return;

      const untilFade = (this.remainingMs(outgoing) ?? 0) - FADE.trackOut;
      if (untilFade > 0) await sleep(untilFade);
      if (!mine()) return;

      const outFrom = outgoing.fade;
      const outPromise = this.fadeDeck(
        outgoing,
        0,
        FADE.trackOut,
        (t) => outFrom * (1 - t) ** 1.5,
      );

      const untilBoundary = this.remainingMs(outgoing) ?? 0;
      if (untilBoundary > 0) await sleep(untilBoundary);
      if (!mine()) return;

      // The file's own end and the station's boundary should be the same
      // instant; where the manifest and the encode disagree slightly, follow
      // the station, which is what everyone else is following.
      const now = stationPosition(channel);
      if (now.trackIndex === nextIndex && now.offsetSeconds < 2) {
        try {
          incoming.el.currentTime = now.offsetSeconds;
        } catch {
          // Not seekable yet; offset 0 is close enough to the boundary.
        }
      }

      this.route(incoming);
      incoming.fade = 0;
      this.apply(incoming);

      try {
        await incoming.el.play();
      } catch {
        // The next piece would not start. Fall back to the plain step, which
        // re-asks the station on the deck already in hand.
        this.segueing = false;
        await this.advance();
        return;
      }
      if (!mine()) {
        // Paused, or taken over, in the instant it took to start. Don't leave a
        // silent deck running.
        incoming.el.pause();
        return;
      }

      this.activeIndex = this.activeIndex === 0 ? 1 : 0;
      const inPromise = this.fadeDeck(incoming, 1, FADE.trackIn, (t) => t * t * (3 - 2 * t));

      const outDone = await outPromise;
      if (this.disposed) return;
      if (outDone && outgoing.el instanceof HTMLAudioElement) {
        // Release the finished deck: stopped, silent, and holding no source,
        // so it stops buffering and is ready to be prepared afresh.
        outgoing.el.pause();
        outgoing.el.removeAttribute('src');
        outgoing.el.load();
        outgoing.el.preload = 'none';
        outgoing.loaded = null;
        outgoing.fade = 0;
      }

      await inPromise;
    } finally {
      if (this.segueToken === token) this.segueing = false;
    }
  }

  /** Ramp one deck's fade factor to a target. */
  private fadeDeck(
    deck: Deck,
    to: number,
    durationMs: number,
    curve?: (t: number) => number,
  ): Promise<boolean> {
    deck.cancel?.();
    const from = deck.fade;
    return new Promise<boolean>((resolve) => {
      if (durationMs <= 0) {
        deck.fade = to;
        this.apply(deck);
        resolve(true);
        return;
      }
      const stop = ramp(
        durationMs,
        (t) => {
          deck.fade = curve ? curve(t) : from + (to - from) * t;
          this.apply(deck);
        },
        () => {
          deck.fade = to;
          this.apply(deck);
          deck.cancel = null;
          resolve(true);
        },
      );
      deck.cancel = () => {
        stop();
        deck.cancel = null;
        resolve(false);
      };
    });
  }

  /** Start the room. */
  async enter(): Promise<void> {
    await this.start(FADE.entry);
  }

  /** Resume after a pause, rejoining the freshly computed shared position. */
  async play(): Promise<void> {
    await this.start(FADE.playPause);
  }

  /** Ask for the music again after a failed load. The deck is holding a piece
   *  that never arrived, so drop that and let `prepare` assign the source
   *  afresh — and go back to idle first, or a second identical failure would
   *  not be a change of status and the room would say nothing. */
  async retry(): Promise<void> {
    if (this.disposed) return;
    this.active.loaded = null;
    this.setStatus('idle');
    await this.start(FADE.playPause);
  }

  private async start(fadeMs: number): Promise<void> {
    if (this.disposed) return;
    // Both callers are inside a click: bring the context up now, while the
    // gesture still counts.
    this.unlock();
    const deck = this.active;
    const channel = getChannel(this.channelId);

    const loaded = await this.prepare(deck, channel);
    if (this.disposed) return;
    if (!loaded) {
      this.setStatus('error');
      return;
    }

    this.route(deck);
    deck.fade = 0;
    this.apply(deck);

    try {
      await deck.el.play();
    } catch {
      // Only reachable if the gesture chain was broken; the room stays usable
      // and the control shows that sound is not running.
      this.setStatus('blocked');
      return;
    }

    this.setStatus('playing');
    // `play()` resolving means the request was accepted, not that anything is
    // audible yet — on a phone reaching a long file over the network, the first
    // sound can be most of a second later. Starting the ramp there would spend
    // part of the fade on silence and deliver a shorter one than it promises.
    await this.whenAudible(deck);
    if (this.disposed || this.status !== 'playing') return;
    await this.fadeDeck(deck, 1, fadeMs);
  }

  /** Settle until the deck is really making sound. Capped, because a deck that
   *  never reports itself should still fade in rather than sit at silence. */
  private whenAudible(deck: Deck, capMs = 1200): Promise<void> {
    const el = deck.el;
    if (!(el instanceof HTMLAudioElement)) return Promise.resolve();
    // HAVE_FUTURE_DATA and running: sound is already coming out.
    if (el.readyState >= 3 && !el.paused) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        window.clearTimeout(timer);
        el.removeEventListener('playing', done);
        resolve();
      };
      const timer = window.setTimeout(done, capMs);
      el.addEventListener('playing', done);
    });
  }

  /** Fade down over ~1s, then stop. */
  async pause(): Promise<void> {
    if (this.disposed) return;
    const deck = this.active;
    this.setStatus('paused');
    const completed = await this.fadeDeck(deck, 0, FADE.playPause);
    // Something else took this deck over mid-fade (a channel switch, or the
    // visitor pressing play again). Leave it alone.
    if (completed && deck.el instanceof HTMLAudioElement) deck.el.pause();
  }

  async toggle(): Promise<void> {
    if (this.status === 'playing') return this.pause();
    return this.play();
  }

  /** Move to another channel. */
  async setChannel(next: ChannelId): Promise<void> {
    if (this.disposed || next === this.channelId) return;

    const wasPlaying = this.status === 'playing';
    this.channelId = next;

    if (!wasPlaying) {
      // Nothing is audible, so there is nothing to hand over. The next play()
      // will pick up the new channel at its live position.
      this.emit();
      return;
    }

    // A segue may be mid-flight on the very deck we are about to take; tell it
    // to let go before we touch anything.
    this.segueToken++;
    this.segueing = false;

    const outgoing = this.active;
    const incoming = this.idle;
    const channel = getChannel(next);

    this.switching = true;
    this.emit();

    // Load the new piece while the old one is still playing normally. Starting
    // the fade first would mean a slow network turning the handover into a
    // silence of unpredictable length.
    const loaded = await this.prepare(incoming, channel);
    if (this.disposed) return;
    // The new channel will not load. Nothing has faded yet, so the piece in
    // hand keeps playing and only the switch is abandoned.
    if (!loaded) {
      this.channelId = outgoing.loaded?.channel ?? this.channelId;
      this.switching = false;
      this.emit();
      return;
    }

    // The old piece leaves, quickly and on a curve that drops away early.
    const outFrom = outgoing.fade;
    const outPromise = this.fadeDeck(
      outgoing,
      0,
      FADE.channelOut,
      (t) => outFrom * (1 - t) ** 2,
    );

    await sleep(Math.max(0, FADE.channelOut - FADE.channelOverlap));
    if (this.disposed) return;

    this.route(incoming);
    incoming.fade = 0;
    this.apply(incoming);

    try {
      await incoming.el.play();
    } catch {
      // Could not start the new channel — stay where we are rather than
      // leaving the room silent.
      this.channelId = outgoing.loaded?.channel ?? this.channelId;
      this.switching = false;
      this.emit();
      return;
    }

    // Hand over the active role now, so a pause pressed mid-handover acts on
    // the deck the visitor is actually starting to hear.
    this.activeIndex = this.activeIndex === 0 ? 1 : 0;

    // Smoothstep: eases in and settles rather than arriving at full tilt.
    const inPromise = this.fadeDeck(
      incoming,
      1,
      FADE.channelIn,
      (t) => t * t * (3 - 2 * t),
    );

    const outDone = await outPromise;

    // If another switch overtook this one, that switch now owns the outgoing
    // deck and will release it. Releasing it here would cut its audio.
    if (this.disposed) return;
    if (outDone && outgoing.el instanceof HTMLAudioElement) {
      // Release the outgoing deck: silent, stopped, and holding no source, so
      // it stops buffering and cannot be heard again until prepared afresh.
      outgoing.el.pause();
      outgoing.el.removeAttribute('src');
      outgoing.el.load();
      outgoing.el.preload = 'none';
      outgoing.loaded = null;
      outgoing.fade = 0;
    }

    await inPromise;
    if (this.disposed) return;

    this.switching = false;
    this.emit();
  }

  destroy() {
    this.disposed = true;
    this.releaseDecks();
    this.duckCancel?.();
    for (const deck of this.decks) {
      deck.cancel?.();
      if (deck.el instanceof HTMLAudioElement) {
        deck.el.pause();
        deck.el.removeAttribute('src');
        deck.el.load();
      }
      try {
        deck.source?.disconnect();
        deck.gain?.disconnect();
      } catch {
        // Already torn down.
      }
      deck.source = null;
      deck.gain = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.listeners.clear();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** True if the promise settled in time — and, when it carries a boolean of its
 *  own, said yes. False if it is still outstanding, or reported failure. */
function withTimeout(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(handle);
      resolve(value);
    };
    const handle = window.setTimeout(() => finish(false), ms);
    void promise.then((value) => finish(value !== false));
  });
}

/** Whether the graph is available at all. Decided before any deck has a source,
 *  because it settles whether that source needs to be fetched CORS-clean. */
function hasWebAudio(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext,
  );
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Time-based ramp. */
const RAMP_STEP_MS = 25;

function ramp(durationMs: number, onStep: (t: number) => void, onDone: () => void): () => void {
  const start = performance.now();
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const t = Math.min(1, (performance.now() - start) / durationMs);
    if (t >= 1) {
      window.clearInterval(handle);
      onDone();
      return;
    }
    onStep(t);
  };

  const handle = window.setInterval(tick, RAMP_STEP_MS);

  return () => {
    cancelled = true;
    window.clearInterval(handle);
  };
}
