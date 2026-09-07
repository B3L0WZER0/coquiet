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
// Satori's font parser rejects a variable font, so ask Google for the two
// static instances the card uses. An ancient user agent is what makes the CSS
// endpoint answer with .ttf rather than woff2.
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500';
const FONT_CACHE_DIR = join(import.meta.dirname, '.cache');
const OUT = join(import.meta.dirname, '../src/app/opengraph-image.jpg');

async function playfair() {
  const cached = [400, 500].map((w) => join(FONT_CACHE_DIR, `PlayfairDisplay-${w}.ttf`));
  if (!cached.every((f) => existsSync(f))) {
    const css = await fetch(FONT_CSS, { headers: { 'User-Agent': 'Mozilla/4.0' } });
    if (!css.ok) throw new Error(`Playfair lookup failed: ${css.status}`);
    const urls = [...(await css.text()).matchAll(/https:\/\/[^)]+\.ttf/g)].map((m) => m[0]);
    if (urls.length < 2) throw new Error('Playfair lookup returned no static .ttf files.');
    await mkdir(FONT_CACHE_DIR, { recursive: true });
    for (const [i, file] of cached.entries()) {
      const res = await fetch(urls[i]);
      if (!res.ok) throw new Error(`Playfair download failed: ${res.status}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    }
  }
  return Promise.all(cached.map((f) => readFile(f)));
}

const room = BACKGROUND_MANIFEST.find((r) => r.id === ROOM);
if (!room) throw new Error(`No room "${ROOM}" in the manifest.`);

// Crop to the card's 1.91:1 through the room's own focal point, so the card
// frames the photograph the way the site does.
const photo = await sharp(join(import.meta.dirname, `../design-reference/${ROOM}.png`))
  .resize(WIDTH, HEIGHT, { fit: 'cover', position: sharp.strategy.attention })
  .jpeg({ quality: 90 })
  .toBuffer();

const mark = await sharp(join(import.meta.dirname, '../assets/logo.png'))
  .resize(112, 112)
  .png()
  .toBuffer();

const [regular, medium] = await playfair();
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
          color: '#f6f2ec',
          fontFamily: 'Playfair Display',
        },
      },
      e(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 20 } },
        // The same artwork the favicon is cut from, so a shared link and the
        // tab it opens carry the one logo.
        e('img', {
          src: `data:image/png;base64,${mark.toString('base64')}`,
          width: 56,
          height: 56,
        }),
        e(
          'div',
          { style: { fontSize: 34, fontWeight: 400, letterSpacing: '0.08em' } },
          'coquiet',
        ),
      ),
      e(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        e(
          'div',
          { style: { fontSize: 82, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.01em' } },
          'Focus quietly, together.',
        ),
        e(
          'div',
          {
            style: {
              marginTop: 18,
              fontSize: 30,
              fontWeight: 400,
              color: 'rgba(246,242,236,0.82)',
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
    fonts: [
      { name: 'Playfair Display', data: regular, weight: 400, style: 'normal' },
      { name: 'Playfair Display', data: medium, weight: 500, style: 'normal' },
    ],
  },
).arrayBuffer();

// JPEG, not PNG: a photograph at 1200×630 is ~1.4 MB lossless and ~120 KB here,
// and some scrapers give up on a slow image.
const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
await writeFile(OUT, jpeg);

console.log(`${OUT}  ${ROOM}  ${(jpeg.length / 1024).toFixed(0)} KB`);
