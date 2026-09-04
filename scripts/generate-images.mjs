/**
 * Generates the responsive background sets from /design-reference.
 *
 * Usage: npm run assets:images
 *
 * Every image in that folder becomes one room. To add or remove a room, add or
 * remove a file and re-run this; the manifest it writes is the only place the
 * app learns what exists.
 *
 * Name files meaningfully — the filename becomes the room's stable id, and the
 * focal points below are keyed by it. A file called `IMG_4821.png` will work
 * but nobody will be able to maintain its crop.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'design-reference');
const OUT_DIR = path.join(ROOT, 'public/images');
const MANIFEST = path.join(ROOT, 'src/lib/background-manifest.ts');

const WIDTHS = [640, 1024, 1600];
const LQIP_HEIGHT = 18;

/**
 * Where to centre the crop when the viewport is portrait.
 *
 * A phone shows a narrow vertical slice of a 16:9 frame, so which part it lands
 * on has to be chosen by eye — there is nothing to derive it from. These were
 * picked by rendering every image at several focal points and choosing the one
 * that keeps the room legible, favouring frames where a person is visible.
 *
 * Anything not listed defaults to the middle, which is rarely right.
 */
const FOCAL_X = {
  'alpine-lake-studio': 68,
  'cafe-concrete-hall': 50,
  'cafe-garden-door': 68,
  'cafe-windows': 32,
  'calm-ocean-screen': 65,
  'calm-screen-working': 43,
  // No person in frame; centred on the lamp and the shelf above the bench.
  'cave-forest': 70,
  'cave-working': 65,
  'circular-window-studio': 65,
  'cliff-cave': 50,
  'cliffside-cafe-focus': 68,
  'coastal-grotto-writer': 60,
  'coastal-observatory': 74,
  'concrete-cave': 63,
  'desert-arches': 42,
  'desert-rock-pavilion': 60,
  // No person in frame; centred on the lit desk.
  'forest-console-invitation': 50,
  // The exception to favouring a person: the one figure sits so hard against
  // the left edge that framing them means losing the waterfall the image is
  // built around. Centred on the view instead; in portrait they fall outside.
  'forest-waterfall-salon': 18,
  'garden-pool': 66,
  'mist-lake-pavilion': 30,
  'mountain-cavern': 55,
  // No person in frame; centred on the desk and chair.
  'ocean-workstation-invitation': 68,
  'oculus-courtyard': 68,
  'open-ocean-reading-room': 16,
  'rain-garden-pavilion': 64,
  'valley-vault': 34,
};

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
  for (const width of widths) {
    const base = sharp(source).resize({ width, withoutEnlargement: true });
    await base.clone().avif({ quality: 58, effort: 6 }).toFile(path.join(OUT_DIR, `${id}-${width}.avif`));
    await base.clone().webp({ quality: 76 }).toFile(path.join(OUT_DIR, `${id}-${width}.webp`));
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
    chrome,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
  });

  console.log(
    `  ${id.padEnd(22)} ${widths.join('/')}  focal ${String(FOCAL_X[id] ?? 50).padStart(3)}%  chrome ${chrome}`,
  );
}

const lines = [
  '/**',
  ' * Generated by `npm run assets:images` — do not edit by hand.',
  ' *',
  ' * One entry per image in /design-reference. `focalX` is where the crop',
  ' * centres when the viewport is portrait; `lqip` is the blurred placeholder,',
  ' * inlined so the first paint is already warm. `chrome` is the colour along',
  ' * the room\'s bottom edge, handed to the browser to tint its own toolbar.',
  ' */',
  '',
  'export interface ManifestRoom {',
  '  id: string;',
  '  widths: readonly number[];',
  '  focalX: number;',
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
  console.log(`  Add them to FOCAL_X in ${path.relative(ROOT, import.meta.filename)}.`);
}
