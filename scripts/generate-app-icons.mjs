/**
 * Renders the home-screen icons from `src/app/icon.svg`, so the mark is drawn
 * once and everything else is derived from it.
 *
 * Two shapes, because Android and everyone else disagree:
 *
 * - `icon-192` / `icon-512` are the mark as drawn, edge to edge.
 * - `icon-maskable` is the same mark shrunk into the middle 60% of a filled
 *   square. Android crops an installed icon to whatever shape the launcher
 *   likes — circle, squircle, teardrop — and only the centre survives, so a
 *   full-bleed circle would come back with its edges shaved off.
 *
 *   node scripts/generate-app-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';

const SOURCE = join(import.meta.dirname, '../src/app/icon.svg');
const OUT = join(import.meta.dirname, '../public');
/** The disc behind the mark — icon.svg's own taupe, so the shapes agree. */
const FIELD = '#a3927a';

const svg = await readFile(SOURCE);

for (const size of [192, 512]) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  await writeFile(join(OUT, `icon-${size}.png`), png);
}

// A maskable icon is promised a safe circle 80% of the frame across. The mark
// is itself a circle, so a concentric 76% clears that with a hair to spare —
// and the field behind it is the same taupe, so whatever the launcher crops
// to, the corners it keeps are the right colour.
const inner = Math.round(512 * 0.76);
const maskable = await sharp({
  create: { width: 512, height: 512, channels: 4, background: FIELD },
})
  .composite([
    {
      input: await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer(),
      gravity: 'centre',
    },
  ])
  .png()
  .toBuffer();
await writeFile(join(OUT, 'icon-maskable.png'), maskable);

console.log('public/icon-192.png  icon-512.png  icon-maskable.png');
