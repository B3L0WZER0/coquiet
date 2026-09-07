/**
 * Renders the crops a room will actually be seen through, so a focal point can
 * be chosen by looking rather than by guessing.
 *
 * Usage: npm run assets:crops               every image with no focal point yet
 *        npm run assets:crops -- cave-forest desert-coffee
 *        npm run assets:crops -- --wide     the vertical sweep instead
 *
 * Writes one sheet per image to /crops (gitignored). Open it, pick the tile
 * that keeps the room legible, put that number in FOCAL_X in focal-points.mjs,
 * and re-run `npm run assets:images`.
 *
 * The tiles are not decorative crops of the photograph — they are the slice the
 * CSS will take, at the aspect a phone actually has, with the entry copy's own
 * footprint shaded over it. A subject that lands in the shaded band is a
 * subject nobody will see: the headline sits on top of it.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { FOCAL_X, FOCAL_Y } from './focal-points.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'design-reference');
const OUT_DIR = path.join(ROOT, 'crops');

/**
 * The narrowest shape a room is asked to fill: a tall phone, measured off the
 * running app rather than off a spec sheet — the backdrop runs taller than the
 * viewport so the image keeps covering behind the browser's own chrome.
 */
const PHONE = 375 / 876;

/** An ultrawide desktop, the only place the vertical focal point does anything. */
const WIDE = 2560 / 1080;

/**
 * Where the entry copy lands, as a fraction of the frame's height, measured on
 * the running app at phone size: wordmark at the top, then everything from the
 * headline down to the "Enter the room" button.
 */
const COPY_TOP = 0.5;

const TILE = 300;
const SWEEP = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const args = process.argv.slice(2);
const wide = args.includes('--wide');
const ids = args.filter((a) => !a.startsWith('--'));

const all = await sources();
const targets = ids.length > 0 ? ids : Object.keys(all).filter((id) => !(id in FOCAL_X));

async function sources() {
  const files = await readdir(SOURCE_DIR);
  return Object.fromEntries(
    files
      .filter((f) => /\.(png|jpe?g|webp|avif|tiff?)$/i.test(f))
      .sort()
      .map((f) => [f.replace(/\.[^.]+$/, ''), path.join(SOURCE_DIR, f)]),
  );
}

if (targets.length === 0) {
  console.log('Every image already has a focal point. Name one to re-check it:');
  console.log('  npm run assets:crops -- cave-forest');
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });
// The sheets are working material, not part of the project.
await writeFile(path.join(OUT_DIR, '.gitignore'), '*\n', 'utf8');

for (const id of targets) {
  const source = all[id];
  if (!source) {
    console.log(`  no such image: ${id}`);
    continue;
  }
  const meta = await sharp(source).metadata();
  const current = (wide ? FOCAL_Y : FOCAL_X)[id];

  // The room's own value goes in the sweep, so a re-check compares against what
  // is shipping rather than against the nearest round number.
  const sweep = [...new Set(current === undefined ? SWEEP : [...SWEEP, current])].sort((a, b) => a - b);

  const tiles = [];
  for (const value of sweep) {
    const p = value / 100;
    let region;
    if (wide) {
      // Wider than the photograph: the width fills and the height is cropped.
      const h = Math.round(meta.width / WIDE);
      region = { left: 0, top: Math.round(p * (meta.height - h)), width: meta.width, height: h };
    } else {
      const w = Math.round(meta.height * PHONE);
      region = { left: Math.round(p * (meta.width - w)), top: 0, width: w, height: meta.height };
    }

    const image = await sharp(source).extract(region).resize({ width: TILE }).toBuffer();
    // Taken from the tile itself: rounding the aspect by hand lands a pixel out
    // often enough, and an overlay a pixel taller than its tile will not compose.
    const tileH = (await sharp(image).metadata()).height;
    const label = value === current ? `${value}  ← current` : `${value}`;
    const shade = wide
      ? ''
      : `<rect x="0" y="${Math.round(tileH * COPY_TOP)}" width="${TILE}" height="${
          tileH - Math.round(tileH * COPY_TOP)
        }" fill="black" opacity="0.45"/>
         <text x="10" y="${Math.round(tileH * COPY_TOP) + 22} " font-family="sans-serif"
           font-size="13" fill="white" opacity="0.8">under the copy</text>`;
    tiles.push(
      await sharp(image)
        .composite([
          {
            input: Buffer.from(
              `<svg width="${TILE}" height="${tileH}">${shade}
                 <rect x="0" y="0" width="${TILE}" height="26" fill="black" opacity="0.6"/>
                 <text x="10" y="18" font-family="sans-serif" font-size="14" fill="white">${label}</text>
               </svg>`,
            ),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer(),
    );
  }

  const tileH = (await sharp(tiles[0]).metadata()).height;
  const sheet = path.join(OUT_DIR, `${id}${wide ? '-wide' : ''}.png`);
  await sharp({
    create: {
      width: TILE * sweep.length,
      height: tileH,
      channels: 3,
      background: '#111',
    },
  })
    .composite(tiles.map((input, i) => ({ input, left: i * TILE, top: 0 })))
    .png()
    .toFile(sheet);

  console.log(`  ${path.relative(ROOT, sheet)}`);
}

console.log(
  `\n${wide ? 'Vertical' : 'Portrait'} sweep for ${targets.length} image(s). Pick a tile, then set it in ${
    wide ? 'FOCAL_Y' : 'FOCAL_X'
  } in scripts/focal-points.mjs.`,
);
