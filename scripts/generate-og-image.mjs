/**
 * Renders the link preview card — the image every share of coquiet.app shows
 * in Slack, iMessage, Discord and the rest.
 *
 * It runs here rather than at build time on purpose: the card wants the entry
 * screen's real face, and Playfair only exists as a webfont in the app. So the
 * script fetches the TTF into a scratch cache, draws the card once, and commits
 * the result. The deploy stays a plain static export with no font to carry.
 *
 *   node scripts/generate-og-image.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ImageResponse } from 'next/og.js';
import sharp from 'sharp';
import React from 'react';

import { BACKGROUND_MANIFEST } from '../src/lib/background-manifest.ts';

/** Two people working apart, in the same quiet room — the product in one frame. */
const ROOM = 'cliffside-cafe-focus';

const WIDTH = 1200;
const HEIGHT = 630;
const FONT_CACHE_DIR = join(import.meta.dirname, '.cache');
const OUT = join(import.meta.dirname, '../src/app/opengraph-image.jpg');

/**
 * A Google font as static .ttf, cached beside this script.
 *
 * Satori's parser rejects a variable font, so the weights are asked for one by
 * one. An ancient user agent is what makes the CSS endpoint answer with .ttf
 * rather than woff2.
 */
async function googleFont(family, weights) {
  const slug = family.replace(/ /g, '');
  return Promise.all(
    weights.map(async (weight) => {
      const file = join(FONT_CACHE_DIR, `${slug}-${weight}.ttf`);
      if (!existsSync(file)) {
        const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`;
        const css = await fetch(url, { headers: { 'User-Agent': 'Mozilla/4.0' } });
        if (!css.ok) throw new Error(`${family} ${weight} lookup failed: ${css.status}`);
        const ttf = (await css.text()).match(/https:\/\/[^)]+\.ttf/)?.[0];
        if (!ttf) throw new Error(`${family} ${weight} lookup returned no static .ttf.`);
        const res = await fetch(ttf);
        if (!res.ok) throw new Error(`${family} ${weight} download failed: ${res.status}`);
        await mkdir(FONT_CACHE_DIR, { recursive: true });
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
      }
      return { name: family, data: await readFile(file), weight, style: 'normal' };
    }),
  );
}

const room = BACKGROUND_MANIFEST.find((r) => r.id === ROOM);
if (!room) throw new Error(`No room "${ROOM}" in the manifest.`);

// Crop to the card's 1.91:1 through the room's own focal point, so the card
// frames the photograph the way the site does.
const photo = await sharp(join(import.meta.dirname, `../design-reference/${ROOM}.png`))
  .resize(WIDTH, HEIGHT, { fit: 'cover', position: sharp.strategy.attention })
  .jpeg({ quality: 90 })
  .toBuffer();

// Playfair for the headline, as on the entry screen. The wordmark is not
// Playfair: it inherits --font-sans there, so it gets a sans here too — Inter,
// which the site's own stack names, at the same light weight.
const display = await googleFont('Playfair Display', [400]);
const sans = await googleFont('Inter', [300, 400]);
const e = React.createElement;

const png = await new ImageResponse(
  e(
    'div',
    { style: { display: 'flex', width: '100%', height: '100%', position: 'relative' } },
    e('img', {
      src: `data:image/jpeg;base64,${photo.toString('base64')}`,
      width: WIDTH,
      height: HEIGHT,
      style: { position: 'absolute', inset: 0 },
    }),
    // The entry screen's scrim: dark at the bottom, where the words are.
    e('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(to bottom, rgba(12,10,8,0.42) 0%, rgba(12,10,8,0.12) 38%, rgba(12,10,8,0.82) 100%)',
      },
    }),
    e(
      'div',
      {
        style: {
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '56px 64px',
          color: '#f6f1e7',
          fontFamily: 'Playfair Display',
        },
      },
      e(
        'div',
        {
          style: {
            fontFamily: 'Inter',
            fontSize: 34,
            fontWeight: 300,
            letterSpacing: '0.08em',
          },
        },
        'coquiet',
      ),
      e(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        e(
          'div',
          { style: { fontSize: 82, fontWeight: 400, lineHeight: 1.06, letterSpacing: '-0.01em' } },
          'Focus quietly, together.',
        ),
        e(
          'div',
          {
            style: {
              fontFamily: 'Inter',
              marginTop: 18,
              fontSize: 30,
              fontWeight: 400,
              // --text-secondary: the cream at 86%.
              color: 'rgba(246,241,231,0.86)',
            },
          },
          'A shared room. A little music.',
        ),
      ),
    ),
  ),
  {
    width: WIDTH,
    height: HEIGHT,
    fonts: [...display, ...sans],
  },
).arrayBuffer();

// JPEG, not PNG: a photograph at 1200×630 is ~1.4 MB lossless and ~120 KB here,
// and some scrapers give up on a slow image.
const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
await writeFile(OUT, jpeg);

console.log(`${OUT}  ${ROOM}  ${(jpeg.length / 1024).toFixed(0)} KB`);
