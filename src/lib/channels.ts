/**
 * The three music channels.
 *
 * A channel is a *programme*, not a track: an ordered list that plays through
 * and then repeats. Flow currently holds two pieces, Still and Momentum one
 * each, and any of them can grow without anything here changing — the list
 * comes from `audio-manifest.ts`, which `npm run assets:audio` builds by
 * reading `/public/audio`.
 *
 * To add music: drop a file named "<Channel> <n>.mp3" into that folder and run
 * that script. Nothing else needs touching.
 */

import { assetPath } from '@/lib/asset-path';
import { AUDIO_MANIFEST, type ManifestTrack } from '@/lib/audio-manifest';

export type ChannelId = 'still' | 'flow' | 'momentum';

export type Track = ManifestTrack;

export interface Channel {
  id: ChannelId;
  label: string;
  /** Shown in the info popover beside the switch. */
  description: string;
  /** The programme, in order. Never empty. */
  tracks: readonly Track[];
  /** Total length of one pass through the programme, in seconds. */
  durationSeconds: number;
  /**
   * Fixed reference point for the station clock. Position is derived from the
   * visitor's own clock against this constant, so every listener on a channel
   * is at roughly the same place without any server involved.
   */
  epochMs: number;
}

/** 2026-01-01T00:00:00Z — arbitrary, fixed, and in the past. */
const BASE_EPOCH = Date.UTC(2026, 0, 1);

function build(
  id: ChannelId,
  label: string,
  description: string,
  epochMs: number = BASE_EPOCH,
): Channel {
  const manifest = AUDIO_MANIFEST[id] ?? [];
  if (manifest.length === 0) {
    throw new Error(`No audio for the ${label} channel. Run: npm run assets:audio`);
  }
  // The manifest is generated against the domain root; the site may not be there.
  const tracks = manifest.map((t) => ({ ...t, src: assetPath(t.src) }));
  return {
    id,
    label,
    description,
    tracks,
    durationSeconds: tracks.reduce((total, t) => total + t.durationSeconds, 0),
    epochMs,
  };
}

export const CHANNELS: readonly Channel[] = [
  build('still', 'Still', 'Spacious piano, slow strings, very little rhythmic movement.'),
  build('flow', 'Flow', 'Balanced chamber music for steady, sustained concentration.'),
  build('momentum', 'Momentum', 'Brighter strings and restrained rhythmic energy.'),
];

export const DEFAULT_CHANNEL: ChannelId = 'flow';

export function getChannel(id: ChannelId): Channel {
  const channel = CHANNELS.find((c) => c.id === id);
  if (!channel) throw new Error(`Unknown channel: ${id}`);
  return channel;
}

export function isChannelId(value: unknown): value is ChannelId {
  return typeof value === 'string' && CHANNELS.some((c) => c.id === value);
}

/** Where in the programme a channel is: which piece, and how far into it. */
export interface StationPosition {
  trackIndex: number;
  track: Track;
  /** Seconds into that track. */
  offsetSeconds: number;
}

/**
 * Where this channel's continuous programme is right now.
 *
 * Derived purely from the visitor's clock, so it needs no backend and no
 * coordination — every device within a second or two of real time lands in the
 * same place, in the same piece.
 */
export function stationPosition(channel: Channel, now: number = Date.now()): StationPosition {
  const cycleMs = channel.durationSeconds * 1000;
  if (cycleMs <= 0) {
    return { trackIndex: 0, track: channel.tracks[0], offsetSeconds: 0 };
  }

  // Modulo in JS keeps the sign of the dividend, so a clock behind the epoch
  // would otherwise produce a negative position.
  const elapsed = ((((now - channel.epochMs) % cycleMs) + cycleMs) % cycleMs) / 1000;

  let remaining = elapsed;
  for (let index = 0; index < channel.tracks.length; index++) {
    const track = channel.tracks[index];
    if (remaining < track.durationSeconds) {
      return { trackIndex: index, track, offsetSeconds: remaining };
    }
    remaining -= track.durationSeconds;
  }

  // Only reachable through floating-point drift at the very end of a cycle.
  const last = channel.tracks.length - 1;
  return { trackIndex: last, track: channel.tracks[last], offsetSeconds: 0 };
}
