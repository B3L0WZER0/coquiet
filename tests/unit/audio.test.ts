import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioEngine, FADE } from '@/lib/audio-engine';
import {
  CHANNELS,
  DEFAULT_CHANNEL,
  getChannel,
  isChannelId,
  stationPosition,
} from '@/lib/channels';

describe('channel configuration', () => {
  it('has exactly the three channels, with Flow the default', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['still', 'flow', 'momentum']);
    expect(DEFAULT_CHANNEL).toBe('flow');
  });

  it('gives every channel a programme the engine can actually play', () => {
    for (const channel of CHANNELS) {
      expect(channel.tracks.length).toBeGreaterThan(0);
      expect(channel.description).not.toBe('');
      expect(Number.isFinite(channel.epochMs)).toBe(true);
      for (const track of channel.tracks) {
        expect(track.src).toBeTruthy();
        expect(track.durationSeconds).toBeGreaterThan(0);
      }
      // The cycle is the whole programme, not the first piece of it.
      const summed = channel.tracks.reduce((t, x) => t + x.durationSeconds, 0);
      expect(channel.durationSeconds).toBeCloseTo(summed, 3);
    }
  });

  it('encodes track paths so filenames with spaces survive', () => {
    for (const channel of CHANNELS) {
      for (const track of channel.tracks) {
        expect(track.src).toMatch(/^\/audio\//);
        expect(track.src).not.toMatch(/ /);
      }
    }
  });

  it('recognises only real channel ids', () => {
    expect(isChannelId('flow')).toBe(true);
    expect(isChannelId('jazz')).toBe(false);
    expect(isChannelId(null)).toBe(false);
  });
});

describe('shared station position', () => {
  const channel = getChannel('flow');
  const cycle = channel.durationSeconds * 1000;

  it('starts at the top of the programme at the epoch', () => {
    const at = stationPosition(channel, channel.epochMs);
    expect(at.trackIndex).toBe(0);
    expect(at.offsetSeconds).toBe(0);
  });

  it('advances in step with the clock', () => {
    expect(stationPosition(channel, channel.epochMs + 90_000).offsetSeconds).toBeCloseTo(90, 3);
  });

  it('walks into the next piece rather than off the end of the first', () => {
    // Flow holds more than one track, which is the case the old single-track
    // maths could not express at all.
    expect(channel.tracks.length).toBeGreaterThan(1);
    const first = channel.tracks[0].durationSeconds;

    const justBefore = stationPosition(channel, channel.epochMs + (first - 5) * 1000);
    expect(justBefore.trackIndex).toBe(0);

    const justAfter = stationPosition(channel, channel.epochMs + (first + 5) * 1000);
    expect(justAfter.trackIndex).toBe(1);
    expect(justAfter.offsetSeconds).toBeCloseTo(5, 2);
    expect(justAfter.track.src).toBe(channel.tracks[1].src);
  });

  it('never reports a position past the end of the piece it names', () => {
    for (let i = 0; i <= 40; i++) {
      const at = stationPosition(channel, channel.epochMs + (cycle * i) / 40);
      expect(at.offsetSeconds).toBeGreaterThanOrEqual(0);
      expect(at.offsetSeconds).toBeLessThan(at.track.durationSeconds);
      expect(at.track).toBe(channel.tracks[at.trackIndex]);
    }
  });

  it('wraps back to the start after the whole programme', () => {
    const wrapped = stationPosition(channel, channel.epochMs + cycle);
    expect(wrapped.trackIndex).toBe(0);
    expect(wrapped.offsetSeconds).toBeCloseTo(0, 2);

    const past = stationPosition(channel, channel.epochMs + cycle + 30_000);
    expect(past.trackIndex).toBe(0);
    expect(past.offsetSeconds).toBeCloseTo(30, 2);
  });

  it('stays inside the programme for a clock behind the epoch', () => {
    // JS modulo keeps the dividend's sign; a naive version would seek negative.
    const at = stationPosition(channel, channel.epochMs - 30_000);
    expect(at.offsetSeconds).toBeGreaterThanOrEqual(0);
    expect(at.trackIndex).toBe(channel.tracks.length - 1);
  });

  it('puts two listeners on the same channel in the same place', () => {
    const now = Date.now();
    const a = stationPosition(channel, now);
    // Two devices whose clocks differ by half a second.
    const b = stationPosition(channel, now + 500);
    expect(b.trackIndex).toBe(a.trackIndex);
    expect(Math.abs(b.offsetSeconds - a.offsetSeconds)).toBeLessThan(1);
  });

  it('gives each channel its own programme', () => {
    const srcs = CHANNELS.map((c) => c.tracks[0].src);
    expect(new Set(srcs).size).toBe(CHANNELS.length);
  });
});

/**
 * jsdom implements the media element but not playback, so `play` is stubbed and
 * metadata is reported as already loaded. Everything the engine actually
 * decides — which deck is audible, at what volume, with what source — is real.
 */
function stubMedia() {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, 'paused', { value: false, configurable: true, writable: true });
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, 'paused', { value: true, configurable: true, writable: true });
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    get: () => 1,
    configurable: true,
  });
}

/** The <audio> elements the engine created, in creation order. */
function decks(engine: AudioEngine): HTMLAudioElement[] {
  return (engine as unknown as { decks: { el: HTMLAudioElement }[] }).decks.map((d) => d.el);
}

describe('audio engine state', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    // Pin the clock a minute into the programme. Without this these tests read
    // the real time, so which piece the station is playing — and therefore
    // which file a deck loads — changes through the day.
    vi.setSystemTime(getChannel('flow').epochMs + 60_000);
    stubMedia();
    engine = new AudioEngine('flow', 0.6);
  });

  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is silent and idle before entering', () => {
    expect(engine.snapshot().status).toBe('idle');
    for (const el of decks(engine)) {
      expect(el.volume).toBe(0);
      expect(el.getAttribute('src')).toBeNull();
      expect(el.preload).toBe('none');
    }
  });

  it('returns a stable snapshot until something changes', () => {
    // A fresh object on every read spins useSyncExternalStore in a render loop.
    expect(engine.snapshot()).toBe(engine.snapshot());
    const before = engine.snapshot();
    engine.setVolume(0.6);
    expect(engine.snapshot()).toBe(before);
    engine.setVolume(0.2);
    expect(engine.snapshot()).not.toBe(before);
  });

  it('fades in from silence over the entry duration', async () => {
    const promise = engine.enter();
    await vi.advanceTimersByTimeAsync(0);

    const audible = decks(engine).find((el) => !el.paused)!;
    expect(audible.volume).toBe(0);

    await vi.advanceTimersByTimeAsync(FADE.entry / 2);
    expect(audible.volume).toBeGreaterThan(0.1);
    expect(audible.volume).toBeLessThan(0.6);

    await vi.advanceTimersByTimeAsync(FADE.entry);
    await promise;
    expect(audible.volume).toBeCloseTo(0.6, 3);
    expect(engine.snapshot().status).toBe('playing');
  });

  it('fades down before stopping, rather than cutting', async () => {
    await runFade(engine.enter(), FADE.entry);
    const audible = decks(engine).find((el) => !el.paused)!;

    const promise = engine.pause();
    await vi.advanceTimersByTimeAsync(FADE.playPause / 2);
    expect(audible.volume).toBeGreaterThan(0);
    expect(audible.volume).toBeLessThan(0.6);
    expect(audible.paused).toBe(false);

    await vi.advanceTimersByTimeAsync(FADE.playPause);
    await promise;
    expect(audible.paused).toBe(true);
    expect(engine.snapshot().status).toBe('paused');
  });

  it('hands over one piece to the next instead of blending them', async () => {
    await runFade(engine.enter(), FADE.entry);

    const promise = engine.setChannel('still');
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.snapshot().switching).toBe(true);

    // Walk the whole handover, sampling what is audible at each step.
    const total = FADE.channelOut + FADE.channelIn;
    const samples: { at: number; levels: number[] }[] = [];
    for (let elapsed = 0; elapsed <= total + 200; elapsed += 50) {
      samples.push({
        at: elapsed,
        levels: decks(engine)
          .filter((el) => !el.paused)
          .map((el) => el.volume),
      });
      await vi.advanceTimersByTimeAsync(50);
    }

    // Nothing anyone would hear as two pieces at once: whenever both decks are
    // running, one of them is already down in the noise.
    for (const { at, levels } of samples) {
      const loud = levels.filter((v) => v > 0.6 * 0.25);
      expect(loud.length, `two pieces audible at ${at}ms`).toBeLessThanOrEqual(1);
    }

    // And it never actually falls silent through the handover.
    const quietest = Math.min(...samples.map((s) => Math.max(0, ...s.levels)));
    expect(quietest).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(total);
    await promise;

    // Exactly one deck left running, at the visitor's chosen level, and the
    // other released rather than left buffering.
    const after = decks(engine).filter((el) => !el.paused);
    expect(after).toHaveLength(1);
    expect(after[0].volume).toBeCloseTo(0.6, 3);
    expect(engine.snapshot().channel).toBe('still');
    expect(engine.snapshot().switching).toBe(false);

    const released = decks(engine).find((el) => el.paused)!;
    expect(released.getAttribute('src')).toBeNull();
    expect(released.preload).toBe('none');

    // The same two elements throughout — switching never creates new ones.
    expect(decks(engine)).toHaveLength(2);
  });

  it('lets the old piece go before letting the new one in', async () => {
    await runFade(engine.enter(), FADE.entry);
    const before = decks(engine).find((el) => !el.paused)!;

    const promise = engine.setChannel('momentum');
    // Partway through the outgoing fade, the new piece has not started at all.
    await vi.advanceTimersByTimeAsync(FADE.channelOut - FADE.channelOverlap - 100);
    expect(decks(engine).filter((el) => !el.paused)).toHaveLength(1);
    expect(before.volume).toBeLessThan(0.6 * 0.35);

    await vi.advanceTimersByTimeAsync(FADE.channelOut + FADE.channelIn + 200);
    await promise;
    expect(engine.snapshot().channel).toBe('momentum');
  });

  it('moves on to the next piece when one ends', async () => {
    await runFade(engine.enter(), FADE.entry);
    const audible = decks(engine).find((el) => !el.paused)!;
    const firstSrc = audible.getAttribute('src');
    const levelBefore = audible.volume;

    // Pretend the station has crossed into the next piece, then let the deck
    // report that its own file finished.
    const flow = getChannel('flow');
    const intoSecond = flow.epochMs + (flow.tracks[0].durationSeconds + 5) * 1000;
    vi.setSystemTime(intoSecond);
    audible.dispatchEvent(new Event('ended'));
    await vi.advanceTimersByTimeAsync(50);

    expect(audible.getAttribute('src')).not.toBe(firstSrc);
    expect(audible.getAttribute('src')).toBe(flow.tracks[1].src);
    expect(audible.paused).toBe(false);
    // It continues at the level it had — this is not a fresh entry.
    expect(audible.volume).toBeCloseTo(levelBefore, 3);
    expect(engine.snapshot().status).toBe('playing');
  });

  it('ignores a deck ending while it is not the one being listened to', async () => {
    await runFade(engine.enter(), FADE.entry);
    await runFade(engine.pause(), FADE.playPause);

    const stopped = decks(engine).find((el) => el.paused)!;
    stopped.dispatchEvent(new Event('ended'));
    await vi.advanceTimersByTimeAsync(50);
    // A paused room does not start playing again because a file ran out.
    expect(engine.snapshot().status).toBe('paused');
  });

  it('changes channel without starting sound when nothing is playing', async () => {
    await engine.setChannel('momentum');
    expect(engine.snapshot().channel).toBe('momentum');
    expect(decks(engine).every((el) => el.paused !== false)).toBe(true);
  });

  it('keeps the visitor volume separate from the break duck', async () => {
    await runFade(engine.enter(), FADE.entry);
    const audible = decks(engine).find((el) => !el.paused)!;

    await runFade(engine.setDuck(0.35), FADE.duck);
    expect(audible.volume).toBeCloseTo(0.6 * 0.35, 3);
    // The chosen level is untouched, so the UI still shows what they picked.
    expect(engine.getVolume()).toBe(0.6);

    // Changing volume during a break scales the ducked level, not past it.
    engine.setVolume(0.8);
    expect(audible.volume).toBeCloseTo(0.8 * 0.35, 3);

    await runFade(engine.setDuck(1), FADE.duck);
    expect(audible.volume).toBeCloseTo(0.8, 3);
  });

  it('mutes without forgetting the chosen level', async () => {
    await runFade(engine.enter(), FADE.entry);
    const audible = decks(engine).find((el) => !el.paused)!;
    expect(audible.volume).toBeCloseTo(0.6, 3);

    engine.setMuted(true);
    expect(audible.volume).toBe(0);
    // A volume of zero would leave nothing to come back to, and would be what
    // gets remembered for next time.
    expect(engine.getVolume()).toBe(0.6);
    expect(engine.snapshot().volume).toBe(0.6);
    expect(engine.snapshot().muted).toBe(true);

    engine.setMuted(false);
    expect(audible.volume).toBeCloseTo(0.6, 3);
  });

  it('stays silent through a fade while muted', async () => {
    await runFade(engine.enter(), FADE.entry);
    const audible = decks(engine).find((el) => !el.paused)!;
    engine.setMuted(true);

    const promise = engine.pause();
    await vi.advanceTimersByTimeAsync(FADE.playPause / 2);
    expect(audible.volume).toBe(0);
    await vi.advanceTimersByTimeAsync(FADE.playPause);
    await promise;
    expect(audible.volume).toBe(0);
  });

  it('unmutes when the volume is moved off silence', async () => {
    await runFade(engine.enter(), FADE.entry);
    const audible = decks(engine).find((el) => !el.paused)!;

    engine.setMuted(true);
    // Reaching for the slider and having nothing happen reads as broken.
    engine.setVolume(0.4);
    expect(engine.isMuted()).toBe(false);
    expect(audible.volume).toBeCloseTo(0.4, 3);

    // Dragging to zero is not the same gesture and must not silently unmute.
    engine.setVolume(0);
    expect(engine.isMuted()).toBe(false);
    expect(audible.volume).toBe(0);
  });

  it('toggles', () => {
    expect(engine.isMuted()).toBe(false);
    engine.toggleMuted();
    expect(engine.isMuted()).toBe(true);
    engine.toggleMuted();
    expect(engine.isMuted()).toBe(false);
  });

  it('clamps nonsense volumes instead of passing them to the element', () => {
    engine.setVolume(5);
    expect(engine.getVolume()).toBe(1);
    engine.setVolume(-2);
    expect(engine.getVolume()).toBe(0);
    engine.setVolume(Number.NaN);
    expect(engine.getVolume()).toBe(0);
  });

  it('reports blocked rather than throwing when playback is refused', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));
    await engine.enter();
    expect(engine.snapshot().status).toBe('blocked');
  });
});

/** Drive a fade to completion under fake timers. */
async function runFade(promise: Promise<unknown>, durationMs: number) {
  await vi.advanceTimersByTimeAsync(durationMs + 100);
  await promise;
}

/**
 * jsdom has no Web Audio, so the tests above exercise the `el.volume` fallback.
 * On iOS `el.volume` is read-only and that path is silent, so the engine routes
 * each deck through a GainNode instead — but only where it detects the lock.
 * Below, `el.volume` is pinned like iOS pins it, and a stub context stands in
 * for the graph, just enough to prove the fade lands on the gain.
 */
class FakeParam {
  value = 1;
}
class FakeNode {
  gain = new FakeParam();
  connect<T>(next: T): T {
    return next;
  }
  disconnect() {}
}
class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  destination = new FakeNode();
  createMediaElementSource() {
    return new FakeNode();
  }
  createGain() {
    return new FakeNode();
  }
  async resume() {
    this.state = 'running';
  }
  async close() {}
}

describe('audio engine with Web Audio available', () => {
  let engine: AudioEngine;

  const gainOf = (el: HTMLAudioElement) =>
    (engine as unknown as { decks: { el: HTMLAudioElement; gain: FakeNode | null }[] }).decks.find(
      (d) => d.el === el,
    )!.gain!.gain.value;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(getChannel('flow').epochMs + 60_000);
    stubMedia();
    // Stand in for an iPhone: an iOS user agent, and el.volume pinned the way
    // iOS pins it (setter ignored, getter always 1).
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    );
    vi.spyOn(HTMLMediaElement.prototype, 'volume', 'set').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'volume', 'get').mockReturnValue(1);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    engine = new AudioEngine('flow', 0.6);
  });

  afterEach(() => {
    engine.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fades on the GainNode and leaves the element wide open', async () => {
    const promise = engine.enter();
    await vi.advanceTimersByTimeAsync(0);

    const audible = decks(engine).find((el) => !el.paused)!;
    // The element is pinned; iOS would ignore a change here anyway.
    expect(audible.volume).toBe(1);
    expect(gainOf(audible)).toBe(0);

    await vi.advanceTimersByTimeAsync(FADE.entry / 2);
    expect(gainOf(audible)).toBeGreaterThan(0.1);
    expect(gainOf(audible)).toBeLessThan(0.6);

    await vi.advanceTimersByTimeAsync(FADE.entry);
    await promise;
    expect(gainOf(audible)).toBeCloseTo(0.6, 3);
    expect(audible.volume).toBe(1);
  });

  it('mutes and ducks through the gain, not the element', async () => {
    await runFade(engine.enter(), FADE.entry);
    const audible = decks(engine).find((el) => !el.paused)!;

    engine.setMuted(true);
    expect(gainOf(audible)).toBe(0);
    expect(audible.volume).toBe(1);
    expect(engine.getVolume()).toBe(0.6);

    engine.setMuted(false);
    expect(gainOf(audible)).toBeCloseTo(0.6, 3);

    await runFade(engine.setDuck(0.35), FADE.duck);
    expect(gainOf(audible)).toBeCloseTo(0.6 * 0.35, 3);
  });

  it('crossfades on the gains so neither element is turned down', async () => {
    await runFade(engine.enter(), FADE.entry);

    const promise = engine.setChannel('still');
    const total = FADE.channelOut + FADE.channelIn;
    for (let elapsed = 0; elapsed <= total + 200; elapsed += 50) {
      const running = decks(engine).filter((el) => !el.paused);
      // Every running element stays wide open...
      for (const el of running) expect(el.volume).toBe(1);
      // ...and whenever two are audible, the gain says one is nearly gone.
      const loudGains = running.map(gainOf).filter((v) => v > 0.6 * 0.25);
      expect(loudGains.length).toBeLessThanOrEqual(1);
      await vi.advanceTimersByTimeAsync(50);
    }

    await vi.advanceTimersByTimeAsync(total);
    await promise;
    expect(engine.snapshot().channel).toBe('still');
    const after = decks(engine).filter((el) => !el.paused);
    expect(after).toHaveLength(1);
    expect(gainOf(after[0])).toBeCloseTo(0.6, 3);
  });

  it('brings the suspended context up on entry', async () => {
    const ctx = () => (engine as unknown as { ctx: FakeAudioContext | null }).ctx;
    expect(ctx()).toBeNull();
    await runFade(engine.enter(), FADE.entry);
    expect(ctx()?.state).toBe('running');
  });
});
