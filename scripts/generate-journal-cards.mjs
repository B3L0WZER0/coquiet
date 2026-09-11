/**
 * Renders a link-preview card per journal post into public/journal/cards —
 * the post's room, cropped to 1200×630, with its title over it.
 *
 *   npm run assets:journal
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og.js';
import React from 'react';
import sharp from 'sharp';

import { BACKGROUND_MANIFEST } from '../src/lib/background-manifest.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content/journal');
const OUT = join(ROOT, 'public/journal/cards');
const FONT_CACHE_DIR = join(import.meta.dirname, '.cache');

/** Same approach as generate-og-image.mjs: static .ttf, cached. */
async function googleFont(family, weight) {
  const file = join(FONT_CACHE_DIR, `${family.replace(/ /g, '')}-${weight}.ttf`);
  if (!existsSync(file)) {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`, {
      headers: { 'User-Agent': 'Mozilla/4.0' },
    });
    const ttf = (await css.text()).match(/https:\/\/[^)]+\.ttf/)?.[0];
    if (!ttf) throw new Error(`${family} ${weight}: no static .ttf`);
    await mkdir(FONT_CACHE_DIR, { recursive: true });
    await writeFile(file, Buffer.from(await (await fetch(ttf)).arrayBuffer()));
  }
  return { name: family, data: await readFile(file), weight, style: 'normal' };
}

function frontMatter(source) {
  const meta = {};
  for (const line of /^---\n([\s\S]*?)\n---/.exec(source)[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return meta;
}

async function crop(roomId) {
  const room = BACKGROUND_MANIFEST.find((r) => r.id === roomId);
  if (!room) throw new Error(`No room "${roomId}"`);
  const source = join(ROOT, `design-reference/${roomId}.png`);
  const { width, height } = await sharp(source).metadata();
  const h = Math.round(width / (WIDTH / HEIGHT));
  const region =
    h <= height
      ? { left: 0, top: Math.round((room.focalY / 100) * (height - h)), width, height: h }
      : (() => {
          const w = Math.round(height * (WIDTH / HEIGHT));
          return { left: Math.round((room.focalX / 100) * (width - w)), top: 0, width: w, height };
        })();
  return sharp(source).extract(region).resize(WIDTH, HEIGHT).jpeg({ quality: 90 }).toBuffer();
}

const fonts = [await googleFont('Playfair Display', 400), await googleFont('Inter', 300), await googleFont('Inter', 400)];
const e = React.createElement;
await mkdir(OUT, { recursive: true });

for (const file of (await readdir(CONTENT)).filter((f) => f.endsWith('.md'))) {
  const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
  const { title, room } = frontMatter(await readFile(join(CONTENT, file), 'utf8'));
  const photo = await crop(room);

  const png = await new ImageResponse(
    e(
      'div',
      { style: { display: 'flex', width: '100%', height: '100%', position: 'relative' } },
      e('img', { src: `data:image/jpeg;base64,${photo.toString('base64')}`, width: WIDTH, height: HEIGHT, style: { position: 'absolute', inset: 0 } }),
      e('div', {
        style: {
          // Satori ignores `inset`; without a size the shade paints nothing.
          position: 'absolute',
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          // Heavy at the foot: some rooms are pale all the way down.
          background:
            'linear-gradient(to bottom, rgba(12,10,8,0.5) 0%, rgba(12,10,8,0.18) 30%, rgba(12,10,8,0.72) 58%, rgba(12,10,8,0.92) 100%)',
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
          },
        },
        e('div', { style: { fontFamily: 'Inter', fontSize: 30, fontWeight: 300, letterSpacing: '0.08em' } }, 'coquiet · journal'),
        e('div', { style: { fontFamily: 'Playfair Display', fontSize: title.length > 48 ? 58 : 68, lineHeight: 1.1, maxWidth: 1000 } }, title),
      ),
    ),
    { width: WIDTH, height: HEIGHT, fonts },
  ).arrayBuffer();

  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  await writeFile(join(OUT, `${slug}.jpg`), jpeg);
  console.log(`${slug}.jpg  ${(jpeg.length / 1024).toFixed(0)} KB`);
}
