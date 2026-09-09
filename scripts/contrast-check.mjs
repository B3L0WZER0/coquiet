/**
 * WCAG AA contrast audit, measured against the real background.
 *
 * Usage: node scripts/contrast-check.mjs [room-id…] [--force] [--jobs=N]
 *        (needs the dev server running)
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
 *
 * A room that passes is remembered against a fingerprint of the app's source,
 * its own manifest entry and its own encoded files — so adding a photograph
 * costs one room, while touching the veil or a token costs all of them. Name
 * ids to audit exactly those; `--force` ignores the cache.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST = path.join(ROOT, 'src/lib/background-manifest.ts');
const IMAGE_DIR = path.join(ROOT, 'public/images');
const CACHE = path.join(ROOT, 'scripts/.cache/contrast.json');

const URL = process.env.COQUIET_URL ?? 'http://localhost:3000';
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const JOBS = Number(args.find((a) => a.startsWith('--jobs='))?.slice(7)) || 4;
const only = args.filter((a) => !a.startsWith('--'));

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
// over a sunlit one. Each is read from the generated manifest with its own
// entry, which is half of what decides whether it needs auditing again.
const manifest = await readFile(MANIFEST, 'utf8');
const entries = new Map(
  [...manifest.matchAll(/^ {2}\{\n([\s\S]*?)^ {2}\},$/gm)]
    .map((m) => [/id: "([^"]+)"/.exec(m[1])?.[1], m[1]])
    .filter(([id]) => id),
);
if (entries.size === 0) throw new Error('No rooms in the manifest. Run: npm run assets:images');

const unknown = only.filter((id) => !entries.has(id));
if (unknown.length > 0) throw new Error(`Not a room: ${unknown.join(', ')}`);

/**
 * What the room's look depends on: everything under src/ except the manifest —
 * one room arriving must not invalidate the other forty-two — plus this script,
 * since it decides what is measured and how.
 */
async function appHash() {
  const h = createHash('sha1');
  const walk = async (dir) => {
    const found = await readdir(dir, { withFileTypes: true });
    for (const e of found.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (p === MANIFEST) continue;
      if (e.isDirectory()) await walk(p);
      else h.update(p).update(await readFile(p));
    }
  };
  await walk(path.join(ROOT, 'src'));
  h.update(await readFile(import.meta.filename));
  return h.digest('hex');
}

const APP = await appHash();
const images = await readdir(IMAGE_DIR);

async function fingerprint(id) {
  const h = createHash('sha1').update(APP).update(entries.get(id));
  const own = images.filter((f) => /^(.*)-\d+\.(avif|webp)$/.exec(f)?.[1] === id).sort();
  for (const f of own) {
    const s = await stat(path.join(IMAGE_DIR, f));
    h.update(`${f}:${s.size}:${s.mtimeMs}`);
  }
  return h.digest('hex');
}

const prints = new Map();
for (const id of entries.keys()) prints.set(id, await fingerprint(id));

let cache = {};
try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { /* first run */ }

const targets =
  only.length > 0
    ? only
    : [...entries.keys()].filter((id) => FORCE || cache[id] !== prints.get(id));

const skipped = entries.size - targets.length;
if (targets.length === 0) {
  console.log(`\nAll ${entries.size} rooms unchanged since they last passed. --force to re-audit.`);
  process.exit(0);
}

const browser = await chromium.launch();
const results = [];

async function audit(page, label) {
  // Collect every visible text node's box, resolved colour and font size.
  const measured = await page.evaluate(() => {
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
  await settle(page);

  const shot = await page.screenshot({ type: 'png' });
  const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Against the viewport actually being audited, not a fixed desktop width —
  // the phone pass renders narrower and every rect would be sampled elsewhere.
  const scale = info.width / page.viewportSize().width;

  const rows = [];
  for (const target of measured) {
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
    rows.push({
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

  return rows;
}

/**
 * Wait for the page to stop moving: every running transition and animation
 * finished, then two frames so the result has painted. A fixed sleep was either
 * too short — panels were sampled half-open, which reads as a wall of failures
 * — or, for the forty rooms it is right for, far too long.
 */
async function settle(page) {
  await page.evaluate(async () => {
    for (let round = 0; round < 4; round++) {
      // Only what is about to be over: a long ambient drift would otherwise
      // hold the audit for its whole cycle.
      const moving = document.getAnimations().filter((a) => {
        if (a.playState !== 'running') return false;
        const timing = a.effect?.getTiming();
        return timing?.iterations !== Infinity && Number(timing?.duration) <= 3000;
      });
      if (moving.length === 0) break;
      await Promise.all(moving.map((a) => a.finished.catch(() => {})));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/** The photograph, decoded — sampling the blurred placeholder audits a room that isn't there. */
async function loaded(page) {
  await page.locator('img.room-image').waitFor({ state: 'attached', timeout: 20000 });
  await page.evaluate(async () => {
    await document.querySelector('img.room-image').decode().catch(() => {});
  });
  await settle(page);
}

/** What a filtered network does: answer the request, with a page. */
const BLOCKED_AUDIO = /\.m4a(\?|$)/;
const blockWithPage = (route) =>
  route.fulfill({ status: 403, contentType: 'text/html', body: '<html>blocked</html>' });

// A dropped request used to be audited like any other page: the browser's own
// error screen scores 1.00:1 and got reported as the room failing AA. Insist on
// a real response, and say so plainly when there isn't one.
async function goto(page, target) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await page.goto(target).catch(() => null);
    if (response?.ok()) return loaded(page);
    if (attempt === 3) {
      throw new Error(`${target} would not load (${response?.status() ?? 'no response'}). Is the dev server still up?`);
    }
    await page.waitForTimeout(1000);
  }
}

/** Enter, and wait for the entry layer to be gone rather than for a number: on
 *  a loaded machine a fixed wait ran out while it was still over the room, and
 *  the next click hit it instead. */
async function enter(page) {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.locator('.entry-layer').waitFor({ state: 'detached', timeout: 20000 });
  await settle(page);
}

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function auditRoom(roomId) {
  // A context per room, so every room is audited as a first-time visitor
  // without clearing storage, and so rooms can run beside each other.
  const context = await browser.newContext({ viewport: DESKTOP });
  // Pin the 100s light drift at its first frame. Sampled at whatever phase the
  // run happens to reach, a room's numbers move on their own between runs —
  // which a cache of what already passed cannot live with.
  await context.addInitScript(() => {
    const pin = () => {
      const s = document.createElement('style');
      s.textContent =
        '.mix-blend-soft-light{animation-delay:0s!important;animation-play-state:paused!important}';
      document.head.append(s);
    };
    if (document.head) pin();
    else document.addEventListener('DOMContentLoaded', pin);
  });
  const page = await context.newPage();
  const rows = [];
  const at = async (label) => rows.push(...(await audit(page, label)));

  const phone = async (label) => {
    // The phone gets a different composition — type along the foot of the
    // photograph rather than against a shaded side — so it is a different veil
    // and has to be checked as one.
    await page.setViewportSize(PHONE);
    await settle(page);
    await at(label);
    await page.setViewportSize(DESKTOP);
    await settle(page);
  };

  try {
    await goto(page, `${URL}/?room=${roomId}`);

    // Whether the presence line is up when the audit looks is down to who else
    // is in the room, and a line audited only when someone happened to be there
    // is a line that is not audited. Force it, as the focus note is forced.
    await page.evaluate(() => {
      const line = document.querySelector('.entry-presence-slot p');
      if (line) {
        line.style.opacity = '1';
        line.lastChild.textContent = '4 people focusing together';
      }
    });
    await settle(page);

    await at(`${roomId} · entry`);
    await phone(`${roomId} · entry phone`);

    // The release notes: small type over a panel that still sits on the
    // photograph. It rises out of the corner into the lit side of the frame,
    // which is the half the entry scrim deliberately leaves alone.
    await page.getByRole('button', { name: /^Version / }).click();
    await settle(page);
    await at(`${roomId} · version panel`);

    // Its other face: two fields and a button, none of which the pass above
    // sees, because one face is shown at a time.
    await page.getByRole('button', { name: 'Request a feature' }).click();
    await settle(page);
    await at(`${roomId} · version form`);
    await page.keyboard.press('Escape');
    await settle(page);

    await enter(page);

    // The focus note is chosen from the clock, so which one is on screen
    // depends on the hour the audit happens to run in. Force the longest, which
    // wraps onto a second line and is the hardest case for the pool of shade.
    await page.evaluate(() => {
      const note = document.querySelector('.area-note p');
      if (note) note.textContent = 'The difficult part is usually the next part.';
    });
    await settle(page);
    await at(`${roomId} · room`);

    // The phone puts the whole room in one floating dock, with a word under
    // every mark — small type over a translucent panel, so it is checked too.
    await phone(`${roomId} · room phone`);

    // Open every panel so their contents are audited too.
    for (const [name, label] of [
      ['What the channels are', 'channel info'],
      [/Focus timer/, 'timer panel'],
      [/presence/i, 'presence panel'],
    ]) {
      await page.getByRole('button', { name }).first().click();
      await settle(page);
      await at(`${roomId} · ${label}`);
      await page.keyboard.press('Escape');
      await settle(page);
    }

    // The room with its music blocked. A filtered network answers the audio
    // request with a page rather than refusing it, and what the room says about
    // that is three more lines of type over the photograph — in the middle of
    // the frame, where the veil is thinnest. It needs the request to actually
    // fail, so it cannot ride along with the passes above.
    await page.route(BLOCKED_AUDIO, blockWithPage);
    await goto(page, `${URL}/?room=${roomId}`);
    await enter(page);
    await at(`${roomId} · music blocked`);
    await phone(`${roomId} · music blocked phone`);
  } catch (cause) {
    throw new Error(`${roomId}: ${cause.message}`, { cause });
  } finally {
    await context.close();
  }

  return rows;
}

console.log(
  `\nAuditing ${targets.length} of ${entries.size} rooms` +
    (skipped > 0 ? `, ${skipped} unchanged since they last passed` : '') +
    ` · ${Math.min(JOBS, targets.length)} at a time\n`,
);

const passing = [];
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(JOBS, targets.length) }, async () => {
    while (next < targets.length) {
      const id = targets[next++];
      const rows = await auditRoom(id);
      results.push(...rows);
      const failed = rows.filter((r) => !r.pass).length;
      if (failed === 0) passing.push(id);
      console.log(`  ${failed === 0 ? 'ok  ' : 'FAIL'} ${id} — ${rows.length} elements${failed ? `, ${failed} below AA` : ''}`);
    }
  }),
);

await browser.close();

// Remember only what passed, and only for rooms still in the manifest, so the
// cache cannot grow forever or vouch for a room that has since changed.
const kept = Object.fromEntries(
  [...prints].filter(([id]) => passing.includes(id) || (cache[id] === prints.get(id) && !targets.includes(id))),
);
await mkdir(path.dirname(CACHE), { recursive: true });
await writeFile(CACHE, JSON.stringify(kept, null, 2), 'utf8');

const failures = results.filter((r) => !r.pass);
const sorted = [...results].sort((a, b) => a.ratio - b.ratio);

console.log(`\nWCAG AA contrast — ${results.length} text elements across ${targets.length} rooms\n`);
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
