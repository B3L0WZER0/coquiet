/**
 * Builds the Ambient room's stills and sound loops from /ambient-inbox/src.
 *
 * Usage: npm run assets:ambient              every scene
 *        npm run assets:ambient -- coast     just one
 *        npm run assets:ambient -- --loop    only the moving loops, then upload them
 *
 * Each scene needs `<id>.<webp|png|jpg>` (a picture — it wins over footage)
 * or `<id>.mp4` (footage to take one frame from at `still` seconds) and `<id>-sound.<ext>` (a field recording).
 * Footage beside a picture becomes the scene's moving loop, played over it:
 * its tail is crossfaded into its head like the sound's, and the files go to
 * R2 (served at /audio/*) rather than GitHub Pages. `--no-upload` skips that.
 * The sound runs [start, start + loop + fade], and its last `fade` seconds are
 * crossfaded into its first, so the last sample leads back into the first.
 *
 * Writes /public/ambient and rewrites src/lib/ambient-manifest.ts.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const INBOX = path.join(ROOT, 'ambient-inbox/src');
const OUT = path.join(ROOT, 'public/ambient');
const MANIFEST = path.join(ROOT, 'src/lib/ambient-manifest.ts');
/** Gitignored, and served by `next dev`; production reads the same names from R2. */
const LOOP_OUT = path.join(ROOT, 'public/audio');
const R2 = 'r2:coquiet-audio';

/** A steep FIR low-pass: flat to `hz`, −90 dB by 13% above it. */
const BRICKWALL = (hz) =>
  `firequalizer=gain_entry='entry(0,0);entry(${hz},0);entry(${Math.round(hz * 1.13)},-90);entry(24000,-90)':delay=0.1:fixed=on`;

/**
 * Seconds throughout. `focalX` is the % kept on a phone. `eq` shapes
 * the recording before it is levelled; `gainDb` trims it against the others.
 * Sources and licences are listed in ambient-inbox/SOURCES.md.
 */
export const SCENES = {
  coast: {
    still: 11,
    sound: { start: 6, loop: 222, fade: 8 },
    // The cut above 16 kHz only removes faint clicks up there. Don't pull it
    // lower: the foam's fizz lives in 6–12 kHz, and without it the waves go dull.
    eq: `highpass=f=60,${BRICKWALL(16000)},acompressor=threshold=0.05:ratio=2:attack=40:release=600`,
    focalX: 55,
    gainDb: 0,
  },
  forest: {
    still: 13,
    sound: { start: 3, loop: 280, fade: 8 },
    // A whine sits at ~10.7 kHz under the birds; nothing wanted lives there.
    eq: `highpass=f=80,${BRICKWALL(8500)}`,
    focalX: 55,
    gainDb: -1,
  },
  snow: {
    still: 7,
    sound: { start: 5, loop: 270, fade: 8 },
    eq: 'highpass=f=40,acompressor=threshold=0.05:ratio=2.5:attack=40:release=600',
    focalX: 15,
    gainDb: 1,
  },
};

/** A few dB under the music (about −14.5), since weather is heard for hours
 *  rather than listened to — close enough that nobody reaches for the volume
 *  switching rooms. */
const TARGET_LUFS = -19;
const STILLS = ['webp', 'png', 'jpg'];
const POSTER_WIDTHS = [960, 1920];
const WIDE_FIT = 'scale=1920:1080:flags=lanczos';
// A portrait phone shows a narrow slice of a wide frame, blown up. A 3:4 crop
// around the focal point spends every pixel on that slice instead.
const TALL_FIT = (focalX) => `crop=ih*3/4:ih:(iw-ih*3/4)*${focalX / 100}:0,scale=1080:1440:flags=lanczos`;

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
/** `--sound` re-cuts only the audio, keeping the videos and posters as they are. */
const SOUND_ONLY = process.argv.includes('--sound');
const LOOP_ONLY = process.argv.includes('--loop');
const NO_UPLOAD = process.argv.includes('--no-upload');
await mkdir(OUT, { recursive: true });

const ff = (args) =>
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit', env: { ...process.env, SVT_LOG: '1' } });
const probe = (file) =>
  Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
      .toString()
      .trim(),
  );

/** The first of `exts`, in that order, that exists. */
function source(id, suffix, exts) {
  const files = readdirSync(INBOX);
  const hit = exts.map((e) => `${id}${suffix}.${e}`).find((f) => files.includes(f));
  if (!hit) throw new Error(`Missing ambient-inbox/${id}${suffix}.{${exts.join(',')}}`);
  return path.join(INBOX, hit);
}

/** The filtergraph that folds a recording's tail into its head. */
function seamless(kind, { loop, fade }) {
  const [split, trim, fadeOp] = ['asplit=3', 'atrim', `acrossfade=d=${fade}:c1=qsin:c2=qsin`];
  const pts = 'asetpts=PTS-STARTPTS';
  const concat = 'concat=n=2:v=0:a=1';
  return [
    `[${kind}in]${split}[b][t][h]`,
    `[b]${trim}=${fade}:${loop},${pts}[body]`,
    `[t]${trim}=${loop}:${loop + fade},${pts}[tail]`,
    `[h]${trim}=0:${fade},${pts}[head]`,
    `[tail][head]${fadeOp}[seam]`,
    `[body][seam]${concat}[${kind}out]`,
  ].join(';');
}

/** Seconds of footage folded back into the start of a loop. */
const LOOP_FADE = 1.5;
const LOOP_FPS = 24;
/** Bump to re-encode every loop; part of each file's name. */
const LOOP_ENCODE = 'v2';
// Capped so a busy clip (spray, snowfall) can't balloon: about 3 MB a loop wide.
const LOOP_SHAPES = {
  wide: { kbps: 2800, fit: () => 'scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080' },
  tall: { kbps: 1400, fit: (focalX) => `crop=ih*3/4:ih:(iw-ih*3/4)*${focalX / 100}:0,scale=768:1024:flags=lanczos` },
};
const LOOP_CODECS = {
  av1: (kbps) => ['-c:v', 'libsvtav1', '-crf', '36', '-preset', '5', '-svtav1-params', `tune=0:mbr=${kbps}`],
  h264: (kbps) => ['-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-profile:v', 'high',
    '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`, '-movflags', '+faststart'],
};

/** The footage beside a picture, if there is any. */
function footage(id) {
  const files = readdirSync(INBOX);
  if (!STILLS.some((e) => files.includes(`${id}.${e}`))) return null;
  const hit = ['mp4', 'mov', 'webm'].map((e) => `${id}.${e}`).find((f) => files.includes(f));
  return hit ? path.join(INBOX, hit) : null;
}

/**
 * Encodes one scene's loop in both shapes and codecs. Names carry a hash of
 * the footage and settings, since R2 serves them as immutable.
 */
function encodeLoop(id, cfg, src) {
  const hash = createHash('sha256')
    .update(readFileSync(src))
    .update(JSON.stringify([LOOP_ENCODE, cfg.focalX, LOOP_FADE, LOOP_FPS]))
    .digest('hex')
    .slice(0, 8);
  const base = `ambient-${id}-${hash}`;
  const loop = probe(src) - LOOP_FADE - 0.1;
  const F = LOOP_FADE;
  const graph = (fit) =>
    [
      `[0:v]fps=${LOOP_FPS},format=yuv420p,split=3[b][t][h]`,
      `[b]trim=${F}:${loop},setpts=PTS-STARTPTS[body]`,
      `[t]trim=${loop}:${loop + F},setpts=PTS-STARTPTS[tail]`,
      `[h]trim=0:${F},setpts=PTS-STARTPTS[head]`,
      `[tail][head]xfade=transition=fade:duration=${F}:offset=0[seam]`,
      `[body][seam]concat=n=2:v=1:a=0,${fit}[out]`,
    ].join(';');
  for (const [shape, { kbps, fit }] of Object.entries(LOOP_SHAPES)) {
    for (const [codec, args] of Object.entries(LOOP_CODECS)) {
      const out = path.join(LOOP_OUT, `${base}-${shape}.${codec}.mp4`);
      if (existsSync(out)) continue;
      ff(['-i', src, '-filter_complex', graph(fit(cfg.focalX)), '-map', '[out]', '-an', ...args(kbps), out]);
      console.log(`  loop ${path.basename(out)} ${(readFileSync(out).length / 1e6).toFixed(1)} MB`);
    }
  }
  return base;
}

// Keep scenes that were not rebuilt this run.
let previous = {};
if (existsSync(MANIFEST)) {
  const text = readFileSync(MANIFEST, 'utf8');
  const json = text.match(/AMBIENT_MANIFEST[^=]*= (\{[\s\S]*\});/);
  if (json) previous = JSON.parse(json[1]);
}
function previousScene(id) {
  return previous[id] ?? null;
}

const manifest = {};

for (const [id, cfg] of Object.entries(SCENES)) {
  if (only.length && !only.includes(id)) continue;
  console.log(`\n${id}`);

  // --- picture ----------------------------------------------------------
  const kept = SOUND_ONLY || LOOP_ONLY ? previousScene(id) : null;
  if (!kept) {
  // A still for now: one frame of the footage, wide and in a 3:4 crop for
  // portrait phones. Moving loops come later.
  const video = source(id, '', [...STILLS, 'mp4', 'mov', 'webm']);
  const seek = STILLS.includes(path.extname(video).slice(1)) ? [] : ['-ss', String(cfg.still)];
  const frame = path.join(OUT, `.${id}-frame.png`);
  const tallFrame = path.join(OUT, `.${id}-tall.png`);
  for (const [fit, out] of [[WIDE_FIT, frame], [TALL_FIT(cfg.focalX), tallFrame]]) {
    const pre = [cfg.crop ? `crop=${cfg.crop}` : null, fit].filter(Boolean).join(',');
    ff([...seek, '-i', video, '-frames:v', '1', '-vf', pre, out]);
  }
  const poster = async (from, name, width) => {
    await sharp(from).resize({ width }).avif({ quality: 52, effort: 6 }).toFile(path.join(OUT, `${name}.avif`));
    await sharp(from).resize({ width }).webp({ quality: 74 }).toFile(path.join(OUT, `${name}.webp`));
  };
  for (const w of POSTER_WIDTHS) await poster(frame, `${id}-${w}`, w);
  await poster(tallFrame, `${id}-tall`, 1080);
  execFileSync('rm', [tallFrame]);
  const lqip = await sharp(frame).resize({ height: 18 }).blur(0.6).webp({ quality: 40 }).toBuffer();
  // The floor's colour, for the browser's toolbar.
  const { dominant } = await sharp(frame).extract(await bottomBand(frame)).stats();
  const chrome = `#${[dominant.r, dominant.g, dominant.b].map((c) => Math.round(c * 0.55).toString(16).padStart(2, '0')).join('')}`;
  execFileSync('rm', [frame]);
  manifest[id] = { posterWidths: POSTER_WIDTHS, focalX: cfg.focalX, chrome, lqip: `data:image/webp;base64,${lqip.toString('base64')}` };
  } else {
    manifest[id] = kept;
  }

  // --- loop -------------------------------------------------------------
  if (!SOUND_ONLY) {
    const src = footage(id);
    manifest[id] = { ...manifest[id], loop: src ? encodeLoop(id, cfg, src) : null };
  }
  if (LOOP_ONLY) continue;

  // --- sound ------------------------------------------------------------
  const sound = source(id, '-sound', ['wav', 'flac', 'mp3', 'm4a', 'ogg', 'aif', 'aiff']);
  const s = cfg.sound;
  const soundOut = path.join(OUT, `${id}.m4a`);
  const tmp = path.join(OUT, `.${id}-sound.wav`);
  ff([
    '-ss', String(s.start), '-t', String(s.loop + s.fade + 0.5), '-i', sound,
    '-filter_complex', `[0:a]aresample=48000,aformat=channel_layouts=stereo${cfg.eq ? `,${cfg.eq}` : ''}[ain];${seamless('a', s)}`,
    '-map', '[aout]', tmp,
  ]);
  // loudnorm reports on stderr.
  const measured = JSON.parse(
    spawnSync('ffmpeg', ['-v', 'info', '-i', tmp, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'])
      .stderr.toString()
      .match(/\{[\s\S]*\}/)[0],
  );
  const gain = TARGET_LUFS - Number(measured.input_i) + cfg.gainDb;
  ff([
    '-i', tmp, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false`,
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', soundOut,
  ]);
  execFileSync('rm', [tmp]);
  const soundSeconds = probe(soundOut);
  console.log(`  sound ${soundSeconds.toFixed(1)} s at ${(Number(measured.input_i) + gain).toFixed(1)} LUFS`);

  manifest[id] = { ...manifest[id], soundSeconds: Number(soundSeconds.toFixed(3)) };
}

async function bottomBand(file) {
  const { width, height } = await sharp(file).metadata();
  const h = Math.round(height * 0.12);
  return { left: 0, top: height - h, width, height: h };
}

const merged = { ...previous, ...manifest };

await writeFile(
  MANIFEST,
  `/**
 * Generated by \`npm run assets:ambient\` — do not edit by hand.
 */

export interface AmbientSceneFiles {
  soundSeconds: number;
  posterWidths: readonly number[];
  /** % of the width kept on a portrait screen. */
  focalX: number;
  /** The browser toolbar's colour while this scene shows. */
  chrome: string;
  lqip: string;
  /** The moving loop's file stem under /audio, or null for a still. */
  loop: string | null;
}

export const AMBIENT_MANIFEST: Record<'coast' | 'forest' | 'snow', AmbientSceneFiles> = ${JSON.stringify(merged, null, 2)};
`,
);
console.log(`\nWrote ${path.relative(ROOT, MANIFEST)}`);

const loops = Object.values(merged).map((m) => m.loop).filter(Boolean);
if (loops.length && !SOUND_ONLY && !NO_UPLOAD) {
  // copy, never sync: the bucket holds the music too.
  console.log(`\nUploading loops to ${R2}…`);
  execFileSync('rclone', [
    'copy', LOOP_OUT, R2, '--ignore-existing',
    ...loops.flatMap((l) => ['--include', `${l}-*.mp4`]),
    '--header-upload', 'Cache-Control: public, max-age=31536000, immutable',
    '--header-upload', 'Content-Type: video/mp4',
  ], { stdio: 'inherit' });
}
