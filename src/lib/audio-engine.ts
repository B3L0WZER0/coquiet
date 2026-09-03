/** The audio engine. */

import { getChannel, stationPosition, type Channel, type ChannelId } from '@/lib/channels';

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
  /** Lowering and restoring music around a break. */
  duck: 1500,
} as const;

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
        void this.advance();
      });
    }
    return { el, fade: 0, cancel: null, loaded: null, source: null, gain: null };
  }

  // --- web audio ---------------------------------------------------------

  /** Build the context. Left until the first sound so nothing is created on a
   *  page that never enters the room. */
  private ensureContext(): void {
    if (this.ctx || typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      null;
    if (!Ctor) return; // No Web Audio (jsdom, very old browsers): stay on el.volume.
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
    this.emit();
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

  /** Point a deck at a channel and move it to the channel's current shared position. */
  private prepare(deck: Deck, channel: Channel): Promise<void> {
    const el = deck.el;
    if (!(el instanceof HTMLAudioElement)) return Promise.resolve();

    const at = stationPosition(channel);

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
        const now = stationPosition(channel);
        el.currentTime = now.trackIndex === at.trackIndex ? now.offsetSeconds : at.offsetSeconds;
      } catch {
        // Seeking before metadata is ready throws in some browsers; the
        // readyState guard below means we only get here when it is safe.
      }
    };

    if (el.readyState >= 1 /* HAVE_METADATA */) {
      seek();
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const done = () => {
        el.removeEventListener('loadedmetadata', done);
        el.removeEventListener('error', done);
        seek();
        resolve();
      };
      el.addEventListener('loadedmetadata', done);
      el.addEventListener('error', done);
    });
  }

  /** Move the audible deck on to whatever the station is playing now. */
  private async advance(): Promise<void> {
    if (this.disposed) return;
    const deck = this.active;
    const channel = getChannel(this.channelId);

    await this.prepare(deck, channel);
    if (this.disposed || this.status !== 'playing') return;

    this.route(deck);
    try {
      await deck.el.play();
    } catch {
      this.setStatus('blocked');
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

  private async start(fadeMs: number): Promise<void> {
    if (this.disposed) return;
    // Both callers are inside a click: bring the context up now, while the
    // gesture still counts.
    this.unlock();
    const deck = this.active;
    const channel = getChannel(this.channelId);

    await this.prepare(deck, channel);
    if (this.disposed) return;

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
    await this.fadeDeck(deck, 1, fadeMs);
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

    const outgoing = this.active;
    const incoming = this.idle;
    const channel = getChannel(next);

    this.switching = true;
    this.emit();

    // Load the new piece while the old one is still playing normally. Starting
    // the fade first would mean a slow network turning the handover into a
    // silence of unpredictable length.
    await this.prepare(incoming, channel);
    if (this.disposed) return;

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
