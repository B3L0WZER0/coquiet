/**
 * Takes raw music from /audio-inbox and files it into a channel.
 *
 * Usage: npm run audio:intake                    — measure, change nothing
 *        npm run audio:intake -- --apply         — encode, tag, name, file, regenerate
 *        ... --channel=still                     — or name the file "still - foo.mp3"
 *
 * You choose the channel. An earlier version of this script guessed it from
 * brightness, loudness range and low-band flux; leave-one-out over the filed
 * programme got 5 of 8 right, because those measures do not separate these
 * channels at all — Momentum 3 has less low-band movement than Flow 1, Still 2
 * a wider dynamic range than any Flow track. The difference is musical, and
 * ffmpeg cannot hear it. The measurements are still printed, next to what each
 * channel already spans, because they are worth a look before you decide.
 *
 * New tracks are matched to the programme's existing loudness. A channel where
 * one piece is several LU louder is jarring at exactly the moment a listener is
 * trying not to be interrupted.
 */

import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const INBOX = path.join(ROOT, 'audio-inbox');
const AUDIO_DIR = path.join(ROOT, 'public/audio');
const CACHE = path.join(ROOT, 'scripts/.cache/audio-fingerprints.json');

const CHANNELS = ['still', 'flow', 'momentum'];

/** rclone remote and bucket the room actually streams from. */
const REMOTE = 'r2';
const BUCKET = 'coquiet-audio';
/** A track's name never changes once filed, so it can be cached hard. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const AUDIO_RE = /\.(m4a|mp3|wav|flac|aiff?|ogg|opus|wma)$/i;
/** Matches the tracks already in the programme — see generate-audio-manifest.mjs. */
const FILED = /^(still|flow|momentum)\s*(\d+)$/i;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const noUpload = args.includes('--no-upload');
// Filing and uploading come apart whenever rclone was not ready at the time,
// which strands finished tracks locally unless the push can be run on its own.
const uploadOnly = args.includes('--upload-only');
const forceUpload = args.includes('--force-upload');
const forced = args.find((a) => a.startsWith('--channel='))?.split('=')[1]?.toLowerCase();
if (forced && !CHANNELS.includes(forced)) {
  throw new Error(`--channel must be one of ${CHANNELS.join(', ')}`);
}

/** For the upload: long enough that buffering its progress would be useless. */
function runLive(bin, argv) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, argv, { stdio: ['ignore', 'inherit', 'inherit'] });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`))));
  });
}

function run(bin, argv) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve({ out, err }) : reject(new Error(`${bin} failed (${code}):\n${err.slice(-2000)}`)),
    );
  });
}

/** Integrated loudness and loudness range, straight from the R128 scanner. */
async function loudness(file) {
  const { err } = await run('ffmpeg', ['-nostdin', '-v', 'info', '-i', file, '-filter:a', 'ebur128=framelog=quiet', '-f', 'null', '-']);
  const lufs = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)\s*LUFS/.exec(err);
  const lra = /LRA:\s*(-?[\d.]+)\s*LU/.exec(err);
  if (!lufs || !lra) throw new Error(`Could not read loudness from ${path.basename(file)}`);
  return { lufs: Number(lufs[1]), lra: Number(lra[1]) };
}

/** Mean spectral centroid — the honest half of "brightness". */
async function brightness(file) {
  const { out } = await run('ffmpeg', [
    '-nostdin', '-v', 'error', '-i', file,
    '-filter:a', 'aspectralstats=win_size=4096:measure=centroid,ametadata=print:key=lavfi.aspectralstats.1.centroid:file=-',
    '-f', 'null', '-',
  ]);
  let sum = 0;
  let n = 0;
  for (const line of out.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1 || !line.startsWith('lavfi.')) continue;
    const v = Number(line.slice(eq + 1));
    if (Number.isFinite(v)) { sum += v; n++; }
  }
  if (n === 0) throw new Error(`No spectral frames from ${path.basename(file)}`);
  return sum / n;
}

/**
 * Rhythmic drive: how much energy below 200 Hz jumps between 100 ms blocks.
 * A pulse moves it; sustained strings and piano pedal do not.
 */
async function flux(file) {
  const { out } = await run('ffmpeg', [
    '-nostdin', '-v', 'error', '-i', file,
    '-filter:a', 'lowpass=f=200,asetnsamples=n=4410,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
    '-f', 'null', '-',
  ]);
  const levels = [];
  for (const line of out.split('\n')) {
    if (!line.startsWith('lavfi.')) continue;
    const v = Number(line.slice(line.indexOf('=') + 1));
    // Digital silence reports -inf and would swamp the mean.
    if (Number.isFinite(v)) levels.push(v);
  }
  if (levels.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < levels.length; i++) total += Math.abs(levels[i] - levels[i - 1]);
  return total / (levels.length - 1);
}

async function duration(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = Number(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`No duration in ${path.basename(file)}`);
  return d;
}

async function fingerprint(file) {
  const [{ lufs, lra }, centroid, drive, seconds] = await Promise.all([
    loudness(file), brightness(file), flux(file), duration(file),
  ]);
  return { lufs, lra, centroid, drive, seconds };
}

/**
 * Measuring is four passes of ffmpeg over the whole track, so it is kept by
 * name, size and mtime. The inbox is measured through here too: the ordinary
 * way to use this script is a dry run, a look at the numbers, then --apply, and
 * that used to measure the same hour of music twice.
 */
let cache = {};
let dirty = false;
try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { /* first run */ }

async function measured(dir, file) {
  const { size, mtimeMs } = await stat(path.join(dir, file));
  const key = `${file}:${size}:${Math.round(mtimeMs)}`;
  if (!cache[key]) {
    process.stderr.write(`  measuring ${file}\n`);
    cache[key] = await fingerprint(path.join(dir, file));
    dirty = true;
  }
  return cache[key];
}

/** Keep only what is still on disk, so the cache cannot grow forever. */
async function saveCache(known) {
  if (!dirty) return;
  await mkdir(path.dirname(CACHE), { recursive: true });
  const live = Object.fromEntries(
    Object.entries(cache).filter(([k]) => known.some((f) => k.startsWith(`${f}:`))),
  );
  await writeFile(CACHE, JSON.stringify(live, null, 2), 'utf8');
}

/** The filed tracks, as the programme a new one has to sit inside. */
async function referenceSet() {
  const files = (await readdir(AUDIO_DIR)).filter((f) => AUDIO_RE.test(f) && FILED.test(f.replace(/\.[^.]+$/, '')));
  const refs = [];
  for (const file of files.sort()) {
    refs.push({
      file,
      channel: FILED.exec(file.replace(/\.[^.]+$/, ''))[1].toLowerCase(),
      ...(await measured(AUDIO_DIR, file)),
    });
  }
  return refs;
}

function nextSlot(refs, channel) {
  const used = refs.filter((r) => r.channel === channel).map((r) => Number(FILED.exec(r.file.replace(/\.[^.]+$/, ''))[2]));
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

function mmss(s) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

// --- main ---

let inbox;
try {
  inbox = (await readdir(INBOX)).filter((f) => AUDIO_RE.test(f));
} catch {
  throw new Error(`No ${path.relative(ROOT, INBOX)} folder. Create it and drop music in.`);
}

if (uploadOnly || inbox.length === 0) {
  if (!uploadOnly) {
    console.log(`Nothing in ${path.relative(ROOT, INBOX)}/ — drop music files in and run this again.`);
    process.exit(0);
  }
  // Everything below builds on the inbox; upload-only wants none of it.
  await upload();
  process.exit(0);
}

console.log(`Reading the programme already filed in ${path.relative(ROOT, AUDIO_DIR)}/`);
const refs = await referenceSet();
if (refs.length === 0) throw new Error('No filed tracks to compare against. public/audio is empty.');

// Match the programme rather than a broadcast standard: these are the levels
// listeners already have their volume set for.
const target = refs.reduce((s, r) => s + r.lufs, 0) / refs.length;
console.log(`  ${refs.length} tracks, mean ${target.toFixed(1)} LUFS\n`);

/** What each channel already spans, so a new number has something to sit against. */
function span(field, digits) {
  return CHANNELS.map((id) => {
    const xs = refs.filter((r) => r.channel === id).map((r) => r[field]);
    return `${id} ${Math.min(...xs).toFixed(digits)}–${Math.max(...xs).toFixed(digits)}`;
  }).join('   ');
}

const plans = [];
const undecided = [];

for (const file of inbox.sort()) {
  const full = path.join(INBOX, file);
  // A channel word at the front of the filename picks the channel, the way
  // "Flow 1.m4a" does for a filed track. --channel beats it, for a whole batch.
  const prefix = /^(still|flow|momentum)\b/i.exec(file)?.[1]?.toLowerCase();
  const chosen = forced ?? prefix ?? null;

  console.log(`${file}`);
  const fp = await measured(INBOX, file);
  const gain = target - fp.lufs;

  console.log(`  ${mmss(fp.seconds)}  ${fp.lufs.toFixed(1)} LUFS → ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`);
  console.log(`  range   ${fp.lra.toFixed(1)} LU     filed: ${span('lra', 1)}`);
  console.log(`  centroid ${Math.round(fp.centroid)} Hz    filed: ${span('centroid', 0)}`);
  console.log(`  drive   ${fp.drive.toFixed(2)}        filed: ${span('drive', 2)}`);
  console.log(`  → ${chosen ? chosen.toUpperCase() + (forced ? ' (--channel)' : ' (from filename)') : 'no channel chosen'}\n`);

  if (!chosen) undecided.push(file);
  plans.push({ file, full, fp, channel: chosen });
}

await saveCache([...refs.map((r) => r.file), ...inbox]);

if (undecided.length > 0) {
  console.log('These measurements do not decide the channel — they overlap too much between the three. Pick one:');
  console.log(`  rename to "still - <name>", "flow - <name>" or "momentum - <name>", or pass --channel=<id>\n`);
  if (apply) throw new Error(`No channel for: ${undecided.join(', ')}`);
}

if (!apply) {
  console.log('Nothing changed. Re-run with --apply to encode and file these.');
  process.exit(0);
}

// Slots are handed out as we go, so two inbox files for one channel don't collide.
const taken = Object.fromEntries(CHANNELS.map((id) => [id, nextSlot(refs, id)]));

for (const plan of plans) {
  const n = taken[plan.channel]++;
  const label = plan.channel[0].toUpperCase() + plan.channel.slice(1);
  const name = `${label} ${n}.m4a`;
  const dest = path.join(AUDIO_DIR, name);

  console.log(`Encoding ${plan.file} → ${name}`);
  await run('ffmpeg', [
    '-nostdin', '-v', 'error', '-y', '-i', plan.full,
    // Matches the tracks already in the programme: 64k AAC LC, 44.1 kHz stereo.
    '-filter:a', `volume=${(target - plan.fp.lufs).toFixed(2)}dB`,
    '-c:a', 'aac', '-b:a', '64k', '-ar', '44100', '-ac', '2',
    '-metadata', `title=${label} ${n}`,
    '-metadata', 'artist=Coquiet',
    '-movflags', '+faststart',
    dest,
  ]);
  const check = await loudness(dest);
  console.log(`  ${name} — ${check.lufs.toFixed(1)} LUFS (target ${target.toFixed(1)})`);
  await rename(plan.full, path.join(INBOX, `${plan.file}.filed`));
}

console.log('\nRegenerating the manifest…');
const { out } = await run('node', [path.join(ROOT, 'scripts/generate-audio-manifest.mjs')]);
console.log(out);

// --- upload ---

async function rcloneReady() {
  try {
    await run('rclone', ['--version']);
  } catch {
    return 'rclone is not installed. `brew install rclone`, then see audio-inbox/README.md.';
  }
  const { out } = await run('rclone', ['listremotes']);
  if (!out.split('\n').some((line) => line.trim() === `${REMOTE}:`)) {
    return `No "${REMOTE}" remote configured. See audio-inbox/README.md for the six answers rclone asks for.`;
  }
  return null;
}

async function upload() {
  const notReady = await rcloneReady();
  if (notReady) {
    console.log(`\nNOT uploaded: ${notReady}`);
    console.log('Filed tracks 404 for every listener until they reach the bucket.');
    console.log('Once rclone is configured: npm run audio:upload');
    process.exit(1);
  }

  // copy, never sync: public/audio is gitignored, so on a fresh clone it can be
  // empty or partial, and `sync` would take the live programme down with it.
  const rcloneArgs = [
    'copy', AUDIO_DIR, `${REMOTE}:${BUCKET}`,
    '--include', '*.m4a',
    '--header-upload', `Cache-Control: ${CACHE_CONTROL}`,
    '--progress', '--stats-one-line',
  ];
  // Filed names are stable and their content does not change, so skipping what
  // is already there keeps a routine run from re-pushing the whole library.
  if (!forceUpload) rcloneArgs.push('--ignore-existing');

  console.log(`\nUploading to ${REMOTE}:${BUCKET}${forceUpload ? ' (--force-upload: overwriting)' : ''}…`);
  await runLive('rclone', rcloneArgs);
  console.log('\nDone. Commit src/lib/audio-manifest.ts to put the new programme live.');
}

if (noUpload) {
  console.log('\nSkipped the upload (--no-upload). These tracks 404 until they reach R2.');
  process.exit(0);
}

await upload();
