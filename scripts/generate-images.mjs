/**
 * Generates the responsive background sets from /design-reference.
 *
 * Usage: npm run assets:images            only what changed
 *        npm run assets:images -- --force everything, ignoring timestamps
 *
 * Every image in that folder becomes one room. To add or remove a room, add or
 * remove a file and re-run this; the manifest it writes is the only place the
 * app learns what exists.
 *
 * Name files meaningfully — the filename becomes the room's stable id, and the
 * focal points in focal-points.mjs are keyed by it. A file called `IMG_4821.png`
 * will work but nobody will be able to maintain its crop.
 *
 * Choosing a focal point is a job for `npm run assets:crops`, which renders the
 * slice a phone will really show. The whole procedure is in CLAUDE.md.
 */

import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { FOCAL_X, FOCAL_Y } from './focal-points.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'design-reference');
const OUT_DIR = path.join(ROOT, 'public/images');
const MANIFEST = path.join(ROOT, 'src/lib/background-manifest.ts');

const FORCE = process.argv.includes('--force');

const WIDTHS = [640, 1024, 1600];
const LQIP_HEIGHT = 18;

const entries = await readdir(SOURCE_DIR);
const sources = entries.filter((f) => /\.(png|jpe?g|webp|avif|tiff?)$/i.test(f)).sort();
if (sources.length === 0) throw new Error(`No images found in ${SOURCE_DIR}`);

await mkdir(OUT_DIR, { recursive: true });

const rooms = [];
const missingFocal = [];

for (const file of sources) {
  const id = file.replace(/\.[^.]+$/, '');
  const source = path.join(SOURCE_DIR, file);
  const meta = await sharp(source).metadata();

  const widths = WIDTHS.filter((w) => !meta.width || w <= meta.width * 1.05);

  // Re-encoding is the slow part by far — avif at effort 6, six files a room.
  // The output only depends on the source file, so a room whose files are all
  // newer than it is already correct. Adding one room to a folder of thirty
  // should cost one room. `--force` re-encodes everything, for when the
  // encoder settings above change rather than the photographs.
  const outputs = widths.flatMap((w) => [`${id}-${w}.avif`, `${id}-${w}.webp`]);
  const sourceTime = (await stat(source)).mtimeMs;
  const times = await Promise.all(
    outputs.map((f) =>
      stat(path.join(OUT_DIR, f)).then(
        (s) => s.mtimeMs,
        () => 0,
      ),
    ),
  );
  const encoded = !FORCE && times.every((t) => t > sourceTime);

  if (!encoded) {
    for (const width of widths) {
      const base = sharp(source).resize({ width, withoutEnlargement: true });
      await base.clone().avif({ quality: 58, effort: 6 }).toFile(path.join(OUT_DIR, `${id}-${width}.avif`));
      await base.clone().webp({ quality: 76 }).toFile(path.join(OUT_DIR, `${id}-${width}.webp`));
    }
  }

  // The placeholder must carry the same aspect ratio as the generated images.
  // Both are drawn with `cover` into the same box, so an aspect even slightly
  // different crops to a different part of the frame — which the eye sees as
  // the room shifting the moment the photograph arrives.
  const largest = widths[widths.length - 1];
  const reference = await sharp(path.join(OUT_DIR, `${id}-${largest}.webp`)).metadata();
  const aspect = reference.width / reference.height;
  const lqipWidth = Math.round(LQIP_HEIGHT * aspect);
  if (Math.abs(lqipWidth / LQIP_HEIGHT - aspect) > 0.005) {
    throw new Error(
      `Placeholder aspect for ${id} does not match the images'. Pick an LQIP height that divides cleanly.`,
    );
  }
  const lqip = await sharp(source)
    // `fill`, not `cover`: the placeholder is the whole frame at the output's
    // proportions, not a crop of it.
    .resize(lqipWidth, LQIP_HEIGHT, { fit: 'fill' })
    .blur(1.2)
    .webp({ quality: 40 })
    .toBuffer();

  if (!(id in FOCAL_X)) missingFocal.push(id);

  // The colour iOS Safari should tint its own toolbar with. The browser will
  // only take a flat colour there — no image reaches behind browser chrome —
  // so the next best thing is the colour the room already is along its bottom
  // edge, which turns a black bar into something the room appears to continue
  // into. Sampled from the focal window, since that is the strip a phone
  // actually shows, and only the bottom eighth, where the bar meets the room.
  const focal = (FOCAL_X[id] ?? 50) / 100;
  const sw = Math.max(1, Math.round(meta.width * 0.3));
  const chromeRaw = await sharp(source)
    .extract({
      left: Math.round(Math.min(Math.max(meta.width * focal - sw / 2, 0), meta.width - sw)),
      top: Math.round(meta.height * 0.875),
      width: sw,
      height: Math.max(1, Math.round(meta.height * 0.125)),
    })
    .resize(1, 1, { fit: 'fill' })
    .raw()
    .toBuffer();
  const chrome =
    '#' + [...chromeRaw.subarray(0, 3)].map((c) => c.toString(16).padStart(2, '0')).join('');

  rooms.push({
    id,
    widths,
    focalX: FOCAL_X[id] ?? 50,
    focalY: FOCAL_Y[id] ?? 50,
    chrome,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
  });

  console.log(
    `  ${encoded ? '·' : '+'} ${id.padEnd(26)} focal ${String(FOCAL_X[id] ?? 50).padStart(3)}%  chrome ${chrome}`,
  );
}

const lines = [
  '/**',
  ' * Generated by `npm run assets:images` — do not edit by hand.',
  ' *',
  ' * One entry per image in /design-reference. `focalX` is where the crop',
  ' * centres when the viewport is portrait, `focalY` where it centres when the',
  ' * viewport is wider than the photograph; `lqip` is the blurred placeholder,',
  ' * inlined so the first paint is already warm. `chrome` is the colour along',
  ' * the room\'s bottom edge, handed to the browser to tint its own toolbar.',
  ' */',
  '',
  'export interface ManifestRoom {',
  '  id: string;',
  '  widths: readonly number[];',
  '  focalX: number;',
  '  focalY: number;',
  '  chrome: string;',
  '  lqip: string;',
  '}',
  '',
  'export const BACKGROUND_MANIFEST: readonly ManifestRoom[] = [',
];

for (const room of rooms) {
  lines.push('  {');
  lines.push(`    id: ${JSON.stringify(room.id)},`);
  lines.push(`    widths: [${room.widths.join(', ')}],`);
  lines.push(`    focalX: ${room.focalX},`);
  lines.push(`    focalY: ${room.focalY},`);
  lines.push(`    chrome: ${JSON.stringify(room.chrome)},`);
  lines.push(`    lqip: ${JSON.stringify(room.lqip)},`);
  lines.push('  },');
}
lines.push('];', '');

await writeFile(MANIFEST, lines.join('\n'), 'utf8');

console.log(`\nWrote ${path.relative(ROOT, MANIFEST)} — ${rooms.length} rooms`);
if (missingFocal.length > 0) {
  console.log(`\n  No focal point set (defaulting to 50%, which is rarely right):`);
  for (const id of missingFocal) console.log(`    - ${id}`);
  console.log('  Run `npm run assets:crops` to choose one, then set it in scripts/focal-points.mjs.');
}
