/**
 * WCAG AA contrast audit, measured against the real background.
 *
 * Usage: node scripts/contrast-check.mjs   (needs the dev server running)
 *
 * Text sitting over a photograph cannot be checked by comparing two declared
 * colours — the background is different under every glyph. So this:
 *
 *   1. resolves each text element's colour to sRGB in the page (the tokens are
 *      `color-mix`, which computed style reports in oklab),
 *   2. hides the text and screenshots the page, giving the actual pixels behind
 *      it, veil and all,
 *   3. compares the text against the *lightest* pixel in its box — the worst
 *      case, not the average.
 *
 * The legibility shadow behind small type is ignored, so every figure here is
 * pessimistic: the real contrast is better than what is reported.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const URL = process.env.COQUIET_URL ?? 'http://localhost:3000';
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

function luminance([r, g, b]) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every room, not just whichever one the hour happens to be showing. They
// differ enormously in brightness, and a veil tuned on a dim room will fail
// over a sunlit one. Ids are read from the generated manifest.
const manifest = await readFile(path.join(import.meta.dirname, '../src/lib/background-manifest.ts'), 'utf8');
const ROOM_IDS = [...manifest.matchAll(/^    id: "([^"]+)",$/gm)].map((m) => m[1]);
if (ROOM_IDS.length === 0) throw new Error('No rooms in the manifest. Run: npm run assets:images');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const results = [];

async function audit(label) {
  // Collect every visible text node's box, resolved colour and font size.
  const targets = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    /** Resolve any CSS colour (including color-mix/oklab) to sRGB bytes. */
    const toRgb = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };

    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);

      const cs = getComputedStyle(el);
      if (Number(cs.opacity) < 0.9) continue;
      // `checkVisibility` walks ancestors, which matters here: the room sits
      // behind the entry layer at opacity 0, and its controls each report an
      // opacity of 1. Measuring them produced failures for text nobody can see.
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;

      // Measure the text's own line boxes, not the element's bounding box.
      // A box includes a pill's rounded corners and any sibling icon, and
      // neither of those is background behind the glyphs — sampling them
      // reports failures that are not there.
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()]
        .filter((r) => r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.top < innerHeight)
        // Trim a hair off each edge: the outermost row of a line box is
        // antialiasing against whatever is outside it.
        .map((r) => ({
          x: r.x + 1,
          y: r.y + 1,
          width: Math.max(1, r.width - 2),
          height: Math.max(1, r.height - 2),
        }));
      if (rects.length === 0) continue;

      const fontSize = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      out.push({
        text: text.slice(0, 40),
        color: toRgb(cs.color),
        // WCAG "large text": 18.66px bold, or 24px at any weight.
        large: fontSize >= 24 || (fontSize >= 18.66 && weight >= 700),
        rects,
      });
    }
    return out;
  });

  // Hide the text, leaving exactly what sits behind it.
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => {
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
        el.style.setProperty('color', 'transparent', 'important');
        el.style.setProperty('text-shadow', 'none', 'important');
      }
    });
  });
  await page.waitForTimeout(300);

  const shot = await page.screenshot({ type: 'png' });
  const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / 1440;

  for (const target of targets) {
    let worst = null;
    let worstRatio = Infinity;

    for (const rect of target.rects) {
      const x0 = Math.max(0, Math.floor(rect.x * scale));
      const y0 = Math.max(0, Math.floor(rect.y * scale));
      const x1 = Math.min(info.width, Math.ceil((rect.x + rect.width) * scale));
      const y1 = Math.min(info.height, Math.ceil((rect.y + rect.height) * scale));

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * info.width + x) * info.channels;
          const px = [data[i], data[i + 1], data[i + 2]];
          const ratio = contrast(target.color, px);
          if (ratio < worstRatio) {
            worstRatio = ratio;
            worst = px;
          }
        }
      }
    }
    if (worst === null) continue;

    const required = target.large ? AA_LARGE : AA_NORMAL;
    results.push({
      state: label,
      text: target.text,
      ratio: worstRatio,
      required,
      pass: worstRatio >= required,
      worstPixel: worst,
    });
  }

  // Restore, so the next state renders normally.
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => {
      el.style.removeProperty('color');
      el.style.removeProperty('text-shadow');
    });
  });
}

for (const roomId of ROOM_IDS) {
  await page.goto(`${URL}/?room=${roomId}`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(2500);

  await audit(`${roomId} · entry`);

  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(2500);

  // The focus note is chosen from the clock, so which one is on screen depends
  // on the hour the audit happens to run in. Force the longest, which wraps
  // onto a second line and is the hardest case for the pool of shade.
  await page.evaluate(() => {
    const note = document.querySelector('.area-note p');
    if (note) note.textContent = 'The difficult part is usually the next part.';
  });
  await page.waitForTimeout(200);
  await audit(`${roomId} · room`);

  // Open every panel so their contents are audited too.
  await page.getByRole('button', { name: 'What the channels are' }).click();
  await page.waitForTimeout(400);
  await audit(`${roomId} · channel info`);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /Focus timer/ }).click();
  await page.waitForTimeout(400);
  await audit(`${roomId} · timer panel`);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /presence/i }).first().click();
  await page.waitForTimeout(400);
  await audit(`${roomId} · presence panel`);
  await page.keyboard.press('Escape');
}

await browser.close();

const failures = results.filter((r) => !r.pass);
const sorted = [...results].sort((a, b) => a.ratio - b.ratio);

console.log(`\nWCAG AA contrast — ${results.length} text elements across ${ROOM_IDS.length} rooms\n`);
console.log('Tightest ten:');
for (const r of sorted.slice(0, 10)) {
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(
    `  ${mark}  ${r.ratio.toFixed(2)}:1 (needs ${r.required}) [${r.state}] "${r.text}"`,
  );
}

if (failures.length > 0) {
  console.log(`\n${failures.length} element(s) below AA:`);
  for (const r of failures) {
    console.log(
      `  ${r.ratio.toFixed(2)}:1 needs ${r.required} — [${r.state}] "${r.text}" over rgb(${r.worstPixel})`,
    );
  }
  process.exit(1);
}

console.log(`\nAll ${results.length} pass AA against the worst pixel behind them.`);
