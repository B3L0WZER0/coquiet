/**
 * Renders every icon the site ships from `assets/logo.png`, the mark as it was
 * drawn.
 *
 * Usage: npm run assets:icons
 * That file and `assets/favicon.ico` are the only hand-made icons in the
 * repo; everything below is derived, so the mark is never edited twice.
 *
 * The mark is a rounded square, and each platform wants that differently:
 *
 * - `icon-192` / `icon-512` are the mark as drawn, rounded corners and all.
 * - `icon-maskable` sits the mark on a filled square at 92%. Android crops an
 *   installed icon to whatever shape the launcher likes — circle, squircle,
 *   teardrop — and only a centre circle 80% across is promised to survive, so
 *   the mark is shrunk to clear that and the field behind it is the same taupe.
 * - `apple-icon` is full bleed and opaque. iOS applies its own corner mask, so
 *   shipping our rounded corners would round them twice, and any transparency
 *   it kept would come back black.
 * - `icon` is what a browser reaches for when it wants better than the .ico —
 *   a retina tab, a bookmark tile — so it only has to beat 48px.
 * - `favicon.ico` is copied, not rendered: the hand-made one is hinted for the
 *   sizes a tab actually draws, which a downscale of the full mark is not.
 *
 */
import { copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';

const ASSETS = join(import.meta.dirname, '../assets');
const PUBLIC = join(import.meta.dirname, '../public');
const APP = join(import.meta.dirname, '../src/app');
/** The field behind the mark, sampled from the artwork so the shapes agree. */
const FIELD = '#9c8d75';

const source = join(ASSETS, 'logo.png');
const render = (size) =>
  sharp(source).resize(size, size, { fit: 'contain', background: '#0000' }).png().toBuffer();

/** The mark centred at `scale` on an opaque square of its own taupe. */
async function onField(size, scale) {
  return sharp({ create: { width: size, height: size, channels: 4, background: FIELD } })
    .composite([{ input: await render(Math.round(size * scale)), gravity: 'centre' }])
    .png()
    .toBuffer();
}

for (const size of [192, 512]) {
  await writeFile(join(PUBLIC, `icon-${size}.png`), await render(size));
}
await writeFile(join(PUBLIC, 'icon-maskable.png'), await onField(512, 0.92));
await writeFile(join(APP, 'apple-icon.png'), await onField(180, 1));
await writeFile(join(APP, 'icon.png'), await render(256));
await copyFile(join(ASSETS, 'favicon.ico'), join(APP, 'favicon.ico'));

console.log('public/icon-192.png  icon-512.png  icon-maskable.png');
console.log('src/app/apple-icon.png  icon.png  favicon.ico');
