/** The three music channels. */

import { AMBIENT_SCENES, sceneSound, type AmbientId } from '@/lib/ambient';
import { audioPath } from '@/lib/asset-path';
import { AUDIO_MANIFEST, type ManifestTrack } from '@/lib/audio-manifest';

export type MusicChannelId = 'still' | 'flow' | 'momentum';
export type ChannelId = MusicChannelId | AmbientId;

/** Which room a channel belongs to. Chosen at the door. */
export type RoomMode = 'music' | 'ambient';

export type Track = ManifestTrack;

export interface Channel {
  id: ChannelId;
  /** Ambient channels are one seamless loop, crossfaded into itself. */
  kind: RoomMode;
  label: string;
  /** Shown in the info popover beside the switch. */
  description: string;
  /** The programme, in order. */
  tracks: readonly Track[];
  /** Total length of one pass through the programme, in seconds. */
  durationSeconds: number;
  /** Fixed reference point for the station clock. */
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
  // The manifest is generated against the domain root; neither the site nor
  // the music is necessarily there.
  const tracks = manifest.map((t) => ({ ...t, src: audioPath(t.src) }));
  return {
    id,
    kind: 'music',
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

/** One loop each. The station clock still applies, so a loop is picked up
 *  mid-way rather than always from its first wave. */
export const AMBIENT_CHANNELS: readonly Channel[] = AMBIENT_SCENES.map((scene) => ({
  id: scene.id,
  kind: 'ambient',
  label: scene.label,
  description: scene.description,
  tracks: [{ src: sceneSound(scene), durationSeconds: scene.soundSeconds, title: scene.sound }],
  durationSeconds: scene.soundSeconds,
  epochMs: BASE_EPOCH,
}));

const ALL_CHANNELS: readonly Channel[] = [...CHANNELS, ...AMBIENT_CHANNELS];

export const DEFAULT_CHANNEL: ChannelId = 'flow';

export function getChannel(id: ChannelId): Channel {
  const channel = ALL_CHANNELS.find((c) => c.id === id);
  if (!channel) throw new Error(`Unknown channel: ${id}`);
  return channel;
}

export function isChannelId(value: unknown): value is ChannelId {
  return typeof value === 'string' && ALL_CHANNELS.some((c) => c.id === value);
}

export function isMusicChannelId(value: unknown): value is MusicChannelId {
  return typeof value === 'string' && CHANNELS.some((c) => c.id === value);
}

export function modeOf(id: ChannelId): RoomMode {
  return isMusicChannelId(id) ? 'music' : 'ambient';
}

/** Where in the programme a channel is: which piece, and how far into it. */
export interface StationPosition {
  trackIndex: number;
  track: Track;
  /** Seconds into that track. */
  offsetSeconds: number;
}

/** Where this channel's continuous programme is right now. */
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
