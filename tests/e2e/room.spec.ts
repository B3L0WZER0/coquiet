import { expect, test, type Page } from '@playwright/test';

/**
 * The critical path: entry → play → switch channel → start timer.
 *
 * Runs against a real browser, which is the only place some of this can be
 * checked at all — media elements, autoplay policy, and focus behaviour all
 * need a genuinely focused page.
 */

/**
 * Watch every media element the engine creates, from before the first one
 * exists, and remember which GainNode ends up shaping each one — the engine
 * routes decks through Web Audio (iOS ignores `el.volume`), so the level that
 * matters lives on the gain, not the element.
 */
async function watchDecks(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __decks: Set<HTMLMediaElement>;
      __gainForEl: Map<HTMLMediaElement, GainNode>;
    };
    w.__decks = new Set();
    w.__gainForEl = new Map();

    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: []) {
      w.__decks.add(this);
      return play.apply(this, args);
    };

    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      const createSource = AC.prototype.createMediaElementSource;
      AC.prototype.createMediaElementSource = function (this: AudioContext, el: HTMLMediaElement) {
        const node = createSource.call(this, el);
        (node as unknown as { __el: HTMLMediaElement }).__el = el;
        return node;
      };
      const connect = AudioNode.prototype.connect as (this: AudioNode, dest: AudioNode) => AudioNode;
      // @ts-expect-error - narrowing the overloaded signature is not worth it here
      AudioNode.prototype.connect = function (this: AudioNode, dest: AudioNode, ...rest: unknown[]) {
        const el = (this as unknown as { __el?: HTMLMediaElement }).__el;
        if (el && dest instanceof GainNode) w.__gainForEl.set(el, dest);
        // @ts-expect-error - forwarding the original variadic call
        return connect.call(this, dest, ...rest);
      };
    }
  });
}

function deckState(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __decks: Set<HTMLMediaElement>;
      __gainForEl: Map<HTMLMediaElement, GainNode>;
    };
    return [...w.__decks].map((d) => {
      const gain = w.__gainForEl.get(d);
      return {
        // The effective level, wherever it is being applied.
        volume: Number((gain ? gain.gain.value : d.volume).toFixed(3)),
        paused: d.paused,
        currentTime: d.currentTime,
      };
    });
  });
}

test.beforeEach(async ({ page }) => {
  await watchDecks(page);
  await page.goto('/');
  // Start every test as a first-time visitor.
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});

test('no audio exists or is fetched before the room is entered', async ({ page }) => {
  const audioRequests: string[] = [];
  page.on('request', (r) => {
    if (/\.mp3(\?|$)/.test(r.url())) audioRequests.push(r.url());
  });

  await expect(page.getByRole('button', { name: 'Enter the room' })).toBeVisible();
  await page.waitForTimeout(1500);

  expect(await deckState(page)).toHaveLength(0);
  expect(audioRequests).toHaveLength(0);
  // The entry screen watches the room, but with nobody in it there is no
  // count to show — only the fact that the room is open.
  await expect(page.getByText('Room open', { exact: true })).toBeVisible();
  await expect(page.getByText(/focusing/)).toHaveCount(0);
});

test('entry starts Flow and fades in from silence', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();

  await expect(page.getByRole('radio', { name: 'Flow' })).toHaveAttribute('aria-checked', 'true');

  // Just after entry: playing, but not yet audible.
  await page.waitForTimeout(400);
  const early = await deckState(page);
  expect(early).toHaveLength(1);
  expect(early[0].paused).toBe(false);
  expect(early[0].volume).toBeLessThan(0.25);

  // By the end of the entry fade it has reached the default level.
  await page.waitForTimeout(4200);
  const settled = await deckState(page);
  expect(settled[0].volume).toBeCloseTo(0.5, 1);

  // It joined the station partway through, not at the beginning of the file.
  expect(settled[0].currentTime).toBeGreaterThan(1);
});

test('switching channel hands over rather than blending', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(4500);

  await page.getByRole('radio', { name: 'Momentum' }).click();

  // Sample through the handover. Two different pieces playing at once is the
  // thing being avoided, so the check is that only one is ever audible.
  const profile: number[][] = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(120);
    const decks = await deckState(page);
    profile.push(decks.filter((d) => !d.paused).map((d) => d.volume));
  }

  for (const levels of profile) {
    expect(levels.filter((v) => v > 0.5 * 0.25).length).toBeLessThanOrEqual(1);
  }
  // And it never drops out entirely.
  expect(Math.min(...profile.map((l) => Math.max(0, ...l)))).toBeGreaterThan(0);

  await page.waitForTimeout(2000);
  const after = await deckState(page);
  expect(after.filter((d) => !d.paused)).toHaveLength(1);
  expect(after.find((d) => !d.paused)!.volume).toBeCloseTo(0.5, 1);

  await expect(page.getByRole('radio', { name: 'Momentum' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('play and pause fade rather than cut', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(4500);

  await page.getByRole('button', { name: 'Pause music' }).click();
  await page.waitForTimeout(400);
  const during = (await deckState(page)).find((d) => !d.paused);
  // Still running, but on its way down.
  expect(during).toBeDefined();
  expect(during!.volume).toBeGreaterThan(0);
  expect(during!.volume).toBeLessThan(0.5);

  await page.waitForTimeout(1000);
  expect((await deckState(page)).every((d) => d.paused)).toBe(true);
  await expect(page.getByRole('button', { name: 'Play music' })).toBeVisible();
});

test('starting a timer counts down and survives a refresh', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: /Focus timer/ }).click();
  await page.getByRole('button', { name: /Start timer/ }).click();

  const timer = page.getByRole('button', { name: /Focus timer/ });
  await expect(timer).toContainText('Focus');
  await page.waitForTimeout(2500);
  await expect(timer).toContainText(/24:5[0-9]/);
});

test('the whole critical path is reachable by keyboard alone', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Enter the room' })).toBeFocused();
  await page.keyboard.press('Enter');

  // Entering hands focus to the room rather than back to the top of the page.
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: 'Pause music' })).toBeFocused();

  // Walk the whole tab cycle and record what it lands on. Tabbing continues
  // from wherever focus already is, so the cycle is read as a set rather than
  // assumed to start at the first control.
  const visited: { name: string; outline: string }[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const entry = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      return {
        name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
        outline: getComputedStyle(el).outlineWidth,
      };
    });
    if (entry) visited.push(entry);
  }

  const names = visited.map((v) => v.name);
  for (const expected of [
    'What the channels are',
    'Still',
    'Flow',
    'Momentum',
    'Volume',
    'Pause music',
  ]) {
    expect(names, `"${expected}" should be reachable by Tab`).toContain(expected);
  }
  expect(names.some((n) => /Focus timer/.test(n))).toBe(true);
  expect(names.some((n) => /presence/i.test(n))).toBe(true);

  // Every control the cycle lands on shows a focus ring.
  for (const { name, outline } of visited) {
    expect(outline, `"${name}" must have a visible focus ring`).not.toBe('0px');
  }
});

test('tabbing past the timer does not pop its panel open', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(1400);

  const timer = page.getByRole('button', { name: /Focus timer/ });
  await timer.focus();
  // A disclosure, not a tooltip: focus alone must not open it.
  await expect(timer).toHaveAttribute('aria-expanded', 'false');

  // But it is still fully operable from the keyboard.
  await page.keyboard.press('Enter');
  await expect(timer).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: /Start timer/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(timer).toHaveAttribute('aria-expanded', 'false');
  await expect(timer).toBeFocused();
});

test('the channel explanations open on hover, on focus and on tap', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(1200);

  const info = page.getByRole('button', { name: 'What the channels are' });
  const panel = page.getByRole('dialog', { name: 'What the channels are' });

  await info.hover();
  await expect(panel).toContainText('Balanced chamber music');
  await page.mouse.move(0, 0);
  await expect(panel).toBeHidden();

  await info.focus();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(info).toBeFocused();

  await info.click();
  await expect(panel).toBeVisible();
  await expect(info).toHaveAttribute('aria-expanded', 'true');
});

test('the room never scrolls, at any size', async ({ page }) => {
  // Enter once. Re-clicking a button that no longer exists would burn a full
  // click timeout on every later size.
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(1400);

  for (const size of [
    { width: 320, height: 640 },
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > window.innerWidth,
      y: document.documentElement.scrollHeight > window.innerHeight,
    }));
    expect(overflow, `overflow at ${size.width}x${size.height}`).toEqual({ x: false, y: false });
  }
});

test('media loading causes no layout shift', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) w.__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(5000);

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.01);
});

test.describe('reduced motion', () => {
  // `test.use({ reducedMotion })` does not take effect in this setup, so the
  // preference is emulated directly on the page instead.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
  });

  test('disables the background drift and collapses transitions', async ({ page }) => {
    await page.getByRole('button', { name: 'Enter the room' }).click();
    await page.waitForTimeout(1200);

    const motion = await page.evaluate(() => {
      const room = document.querySelector('picture img')!;
      const light = document.querySelector('.mix-blend-soft-light')!;
      const control = document.querySelector('.area-music button')!;
      return {
        prefersReduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        // The light change is applied through a motion-safe variant, so under
        // `reduce` the declaration is not there at all.
        light: getComputedStyle(light).animationName,
        // And the photograph itself never moves, in any mode.
        roomTransform: getComputedStyle(room).transform,
        // Everything else keeps its transition property but with no duration,
        // so state still changes — it just does not animate.
        controlTransition: getComputedStyle(control).transitionDuration,
      };
    });

    expect(motion.prefersReduced).toBe(true);
    expect(motion.light).toBe('none');
    expect(motion.roomTransform).toBe('none');
    for (const duration of motion.controlTransition.split(',')) {
      expect(parseFloat(duration)).toBeLessThan(0.01);
    }
  });

  test('the room is still fully usable without any motion', async ({ page }) => {
    await page.getByRole('button', { name: 'Enter the room' }).click();
    await page.waitForTimeout(1200);

    await page.getByRole('radio', { name: 'Momentum' }).click();
    await expect(page.getByRole('radio', { name: 'Momentum' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.getByRole('button', { name: /Focus timer/ }).click();
    await page.getByRole('button', { name: /Start timer/ }).click();
    await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Focus');
  });
});

test('a custom 1 / 10 session is honoured exactly as typed', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(1400);

  const timer = page.getByRole('button', { name: /Focus timer/ });
  await timer.click();
  await page.getByRole('radio', { name: 'Custom' }).click();

  const focus = page.locator('[role=dialog] input[type=number]').first();
  const brk = page.locator('[role=dialog] input[type=number]').nth(1);

  await focus.fill('1');
  await brk.fill('10');
  await brk.blur();

  // The readout must agree with the field, not quietly run a different length.
  await expect(timer).toContainText('Start Timer1:00');
  await expect(focus).toHaveValue('1');

  await page.getByRole('button', { name: /Start timer/ }).click();
  await expect(timer).toContainText(/Focus0:5[0-9]/);
});

test('the custom field can be emptied with backspace', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(1400);

  await page.getByRole('button', { name: /Focus timer/ }).click();
  await page.getByRole('radio', { name: 'Custom' }).click();

  const focus = page.locator('[role=dialog] input[type=number]').first();
  await focus.click();

  // Backspacing a controlled number field used to be impossible: the empty
  // string parsed to NaN, nothing was reported, and the old value was put
  // straight back. Clearing it to type a fresh number needed a select-all.
  await focus.press('End');
  await focus.press('Backspace');
  await expect(focus).toHaveValue('2');
  await focus.press('Backspace');
  await expect(focus).toHaveValue('');

  // Typing then continues from empty rather than appending to what was there.
  await focus.pressSequentially('45');
  await expect(focus).toHaveValue('45');
  await focus.blur();
  await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Start Timer45:00');
});

test('an out-of-range custom value corrects itself visibly', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter the room' }).click();
  await page.waitForTimeout(1400);

  await page.getByRole('button', { name: /Focus timer/ }).click();
  await page.getByRole('radio', { name: 'Custom' }).click();

  const focus = page.locator('[role=dialog] input[type=number]').first();
  await focus.fill('999');
  await focus.blur();

  // Corrected in the field itself, so what is shown is what will run.
  await expect(focus).toHaveValue('180');
  await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Start Timer3:00:00');
});

test.describe('the timer does not outlive the page', () => {
  const enter = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: 'Enter the room' }).click();
    await page.waitForTimeout(1400);
  };

  test('a running session is gone after a refresh', async ({ page }) => {
    await enter(page);
    await page.getByRole('button', { name: /Focus timer/ }).click();
    await page.getByRole('button', { name: /Start timer/ }).click();
    await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Focus');

    await page.reload();
    await enter(page);
    await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Start Timer25:00');
  });

  test('an idle custom length does not come back either', async ({ page }) => {
    await enter(page);
    await page.getByRole('button', { name: /Focus timer/ }).click();
    await page.getByRole('radio', { name: 'Custom' }).click();
    const focus = page.locator('[role=dialog] input[type=number]').first();
    await focus.fill('7');
    await focus.blur();
    await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Start Timer7:00');

    await page.reload();
    await enter(page);
    await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Start Timer25:00');
  });

  test('nothing about the timer is written to storage', async ({ page }) => {
    await enter(page);
    await page.getByRole('button', { name: /Focus timer/ }).click();
    await page.getByRole('button', { name: /Start timer/ }).click();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => localStorage.getItem('coquiet:timer'))).toBeNull();
  });

  test('a session left by an older version is discarded, not resumed', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'coquiet:timer',
        JSON.stringify({
          session: {
            phase: 'focus',
            presetId: '50-10',
            focusMs: 3000000,
            breakMs: 600000,
            endsAt: Date.now() + 2400000,
            pausedRemainingMs: null,
            breakCount: 0,
          },
          updatedAt: Date.now(),
        }),
      );
    });
    await page.reload();
    await enter(page);

    await expect(page.getByRole('button', { name: /Focus timer/ })).toContainText('Start Timer25:00');
    expect(await page.evaluate(() => localStorage.getItem('coquiet:timer'))).toBeNull();
  });
});

test.describe('personal presence is per visit', () => {
  const enter = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: 'Enter the room' }).click();
    await page.waitForTimeout(1400);
  };
  const trigger = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: /presence/i }).first();

  test('what you set applies now and is gone after a refresh', async ({ page }) => {
    await enter(page);
    await expect(trigger(page)).toHaveAttribute('aria-label', 'Set your presence');

    await trigger(page).click();
    await page.locator('[role=dialog] button', { hasText: /^Working$/ }).click();
    await page.locator('[role=dialog] button', { hasText: /^Coffee$/ }).click();
    await page.locator('[role=dialog] button', { hasText: /^Done$/ }).click();

    await expect(trigger(page)).toHaveAttribute('aria-label', /Working · Coffee/);
    // A statement about right now is not written down.
    expect(
      await page.evaluate(() => localStorage.getItem('coquiet:personal-presence')),
    ).toBeNull();

    await page.reload();
    await enter(page);
    await expect(trigger(page)).toHaveAttribute('aria-label', 'Set your presence');
  });

  test('a value stored by an older version is discarded, not adopted', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem(
        'coquiet:personal-presence',
        JSON.stringify({ activity: 'studying', drink: 'tea' }),
      ),
    );
    await page.reload();
    await enter(page);

    await expect(trigger(page)).toHaveAttribute('aria-label', 'Set your presence');
    // And cleared from the browser rather than left lying about.
    expect(
      await page.evaluate(() => localStorage.getItem('coquiet:personal-presence')),
    ).toBeNull();
  });
});

test.describe('the entry composition', () => {
  test('says what the product is, in one glance', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Focus quietly, together' })).toBeVisible();
    await expect(page.getByText(/Quiet company for whatever needs your focus/)).toBeVisible();
    await expect(page.getByText('No chat. No cameras. Just company.')).toBeVisible();
    await expect(page.getByText('Ambient sound fades in. Mute anytime.')).toBeVisible();
  });

  test('the phone is composed differently, not the desktop squeezed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    // The type sits along the foot of the photograph rather than centred in it,
    // so the top half of the room is left whole.
    const copy = (await page.locator('.entry-copy').boundingBox())!;
    expect(copy.y).toBeGreaterThan(844 * 0.45);

    // The support link leaves the corner and becomes a cup beside the door —
    // a circle, on the same centreline, carrying the same name.
    const link = page.locator('.coquiet-support');
    const cta = page.locator('.coquiet-cta');
    await expect(link).toHaveAttribute('aria-label', 'Support us with a coffee');

    const l = (await link.boundingBox())!;
    const c = (await cta.boundingBox())!;
    expect(l.x).toBeGreaterThan(c.x + c.width);
    expect(Math.abs(l.y + l.height / 2 - (c.y + c.height / 2))).toBeLessThan(1.5);
    expect(Math.abs(l.width - l.height)).toBeLessThan(1);

    // The door still gets the room's width, less the cup.
    expect(c.width).toBeGreaterThan(390 * 0.6);

    // And the way in is still one tap, still reachable by keyboard first.
    await page.keyboard.press('Tab');
    await expect(cta).toBeFocused();
  });

  test('the call to action is solid stone, with hover and focus states', async ({ page }) => {
    const cta = page.locator('.coquiet-cta');
    const bg = () => cta.evaluate((el) => getComputedStyle(el).backgroundColor);

    await expect(cta).toHaveText('Enter the room');
    expect(await bg()).toBe('rgb(242, 236, 225)');

    await cta.hover();
    await page.waitForTimeout(350);
    expect(await bg(), 'hover should lift the fill').not.toBe('rgb(242, 236, 225)');

    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
    await expect(cta).toBeFocused();
    const focusRing = await cta.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(focusRing.style).not.toBe('none');
    expect(parseFloat(focusRing.width)).toBeGreaterThan(0);
  });

  test('mute silences the room and gives the level back', async ({ page }) => {
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(5000);

    const volumes = async () =>
      (await deckState(page)).filter((d) => !d.paused).map((d) => d.volume);

    const mute = page.getByRole('button', { name: /^(Mute|Unmute)$/ });
    expect((await volumes())[0]).toBeCloseTo(0.5, 1);
    await expect(mute).toHaveAttribute('aria-pressed', 'false');

    await mute.click();
    await page.waitForTimeout(400);
    expect(await volumes()).toEqual([0]);
    await expect(mute).toHaveAttribute('aria-label', 'Unmute');
    await expect(mute).toHaveAttribute('aria-pressed', 'true');

    await mute.click();
    await page.waitForTimeout(400);
    // The chosen level was kept, not overwritten with zero.
    expect((await volumes())[0]).toBeCloseTo(0.5, 1);
    await expect(mute).toHaveAttribute('aria-label', 'Mute');
  });

  test('the document commits to no room, and only one is ever fetched', async ({ page }) => {
    // The page is prerendered once, so any room named in the HTML is the room
    // of the hour the build ran in — wrong for all but one hour in every 26,
    // and fetched at high priority before the right one is even known.
    const html = await (await page.request.get('/')).text();
    expect(html).not.toMatch(/\/images\/[a-z0-9-]+-\d+\.(avif|webp)/);

    const fetched: string[] = [];
    page.on('request', (r) => {
      const m = /\/images\/(.+)-\d+\.(?:avif|webp)$/.exec(r.url());
      if (m) fetched.push(m[1]);
    });

    await page.goto('/');
    await page.waitForTimeout(2500);

    // One room, and it is the one on screen.
    expect(new Set(fetched).size).toBe(1);
    const shown = await page.evaluate(
      () => (document.querySelector('picture img') as HTMLImageElement).currentSrc,
    );
    expect(shown).toContain(fetched[0]);

    // Its download was started by the chooser, not by the component — so it was
    // already in flight while the bundle was still arriving.
    const preloaded = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="preload"][as="image"]')].map(
        (l) => (l as HTMLLinkElement).imageSrcset,
      ),
    );
    expect(preloaded).toHaveLength(1);
    expect(preloaded[0]).toContain(fetched[0]);
  });

  test('the room image is cropped to the room\'s own focal point in portrait', async ({
    page,
  }) => {
    const state = () =>
      page.evaluate(() => ({
        objectPosition: getComputedStyle(document.querySelector('picture img')!).objectPosition,
        backgroundPosition: getComputedStyle(document.querySelector('.room-image-lqip')!)
          .backgroundPosition,
        // Computed, not inline: the chooser script sets this on :root before
        // the document is parsed, and the crop inherits it from there.
        focal: getComputedStyle(document.querySelector('.room-image-lqip')!)
          .getPropertyValue('--room-focal-x')
          .trim(),
      }));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(200);
    const landscape = await state();
    // Landscape shows the composition as photographed.
    expect(landscape.objectPosition).toBe('50% 50%');

    // A narrow slice of a 16:9 frame taken from the middle is often blank wall,
    // so portrait shifts to a point chosen per image.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(200);
    const portrait = await state();
    expect(portrait.focal).toMatch(/^\d+%$/);
    expect(portrait.objectPosition).toBe(`${portrait.focal} 50%`);
    // The placeholder must be framed identically, or the room jumps when the
    // photograph arrives.
    expect(portrait.backgroundPosition).toBe(portrait.objectPosition);
  });
});

test.describe('watching the room from the doorway', () => {
  test('the entry badge counts the people already working, and not the watcher', async ({
    context,
    page,
  }) => {
    const badge = page.locator('.entry-presence-slot p');
    await expect(badge).toHaveText('Room open');

    // Someone else actually enters.
    const first = await context.newPage();
    await first.goto('/');
    await first.locator('.coquiet-cta').click();
    await first.waitForTimeout(1200);
    await expect(badge).toHaveText('1 person focusing right now');

    const second = await context.newPage();
    await second.goto('/');
    await second.locator('.coquiet-cta').click();
    await second.waitForTimeout(1200);
    await expect(badge).toHaveText('2 people focusing together');

    // The people inside must not be able to see the watcher. Standing in the
    // doorway is not being in the room, and counting it would be a lie told to
    // everybody else.
    await expect(first.locator('.area-presence')).toHaveText('Focusing with 1 other');

    // Entering turns the watcher into one of them.
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('.area-presence')).toHaveText('Focusing with 2 others');
    await expect(first.locator('.area-presence')).toHaveText('Focusing with 2 others');

    await first.close();
    await second.close();
  });

  test('the badge only appears when the room is genuinely being watched', async ({ page }) => {
    // No BroadcastChannel means no way to know anything, so there is no badge
    // and no live dot pretending otherwise.
    await page.addInitScript(() => {
      // @ts-expect-error - removing a global on purpose
      delete window.BroadcastChannel;
    });
    await page.reload();
    await page.waitForTimeout(1200);

    // The slot stays, so the layout does not move; the badge inside it is
    // hidden, from sight and from assistive tech alike, and claims nothing.
    const badge = page.locator('.entry-presence-slot p');
    await expect(badge).toHaveAttribute('aria-hidden', 'true');
    await expect(badge).toHaveCSS('opacity', '0');
    await expect(page.getByText(/focusing/)).toHaveCount(0);

    // The room is still perfectly usable without it.
    await expect(page.locator('.coquiet-cta')).toBeVisible();
  });
});

test.describe('the phone dock', () => {
  test('is one floating dock, each mark named by what it is set to', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(1600);

    // Floating, not a slab flush to the foot of the screen.
    const dock = (await page.locator('.room-controls').boundingBox())!;
    expect(dock.x).toBeGreaterThan(4);
    expect(390 - (dock.x + dock.width)).toBeGreaterThan(4);
    expect(844 - (dock.y + dock.height)).toBeGreaterThan(4);

    // Every mark says what it is currently set to, not what it is called.
    await expect(page.locator('.dock-label')).toHaveText([
      'Flow',
      '25 min',
      '1 here',
      'Presence',
    ]);

    // The one solid thing in the room, and an actual circle — the global focus
    // ring used to square it off at 4px. The mouse is parked first: the entry
    // button it just pressed sits where the play button lands, so it would
    // otherwise still be hovering it.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    const play = page.locator('.area-playback button:visible');
    const shape = await play.evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        bg: c.backgroundColor,
        radius: parseFloat(c.borderRadius),
        width: parseFloat(c.width),
      };
    });
    expect(shape.bg).toBe('rgb(242, 236, 225)');
    expect(shape.radius).toBeGreaterThanOrEqual(shape.width / 2);

    await play.focus();
    const focused = await play.evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
    expect(focused).toBeGreaterThanOrEqual(shape.width / 2);

    // And the dock is still the whole room: four panels, all reachable.
    await expect(page.locator('.dock-trigger')).toHaveCount(4);
  });

  test('every panel it opens is the width of the dock, just above it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(1600);

    const dock = (await page.locator('.room-controls').boundingBox())!;

    for (const nth of [0, 1, 2, 3]) {
      await page.locator('.dock-trigger').nth(nth).click();
      await page.waitForTimeout(300);
      const panel = (await page.locator('[role="dialog"]:visible').boundingBox())!;

      // Squared to the dock, not hung off whichever mark opened it. The dock's
      // own border accounts for the pixel of slack.
      expect(Math.abs(panel.x - dock.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(panel.width - dock.width)).toBeLessThanOrEqual(2);
      // And sitting on top of it, not over it.
      const gap = dock.y - (panel.y + panel.height);
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(24);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  });

  test('a label changing length does not move the marks either side of it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(1600);

    // The marks themselves: a wider word makes its own trigger wider, but the
    // mark stays centred in a slot that does not move.
    const marks = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.dock-trigger svg')].map((el) =>
          Math.round(el.getBoundingClientRect().x),
        ),
      );

    const before = await marks();

    // "Flow" becomes "Momentum", the widest word the dock ever holds.
    await page.locator('.dock-trigger').first().click();
    await page.getByRole('radio', { name: /Momentum/ }).click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(page.locator('.dock-label').first()).toHaveText('Momentum');
    expect(await marks()).toEqual(before);
  });

  test('the timer trigger counts down in place once it is running', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(1600);

    const timer = page.locator('.dock-trigger').nth(1);
    await expect(timer.locator('.dock-label')).toHaveText('25 min');

    await timer.click();
    await page.getByRole('button', { name: /^Start timer/ }).click();
    await page.waitForTimeout(1500);

    await expect(timer.locator('.dock-label')).toHaveText(/^2[45]:\d\d$/);
  });
});

test.describe('the support link', () => {
  test('sits on the way in, and nowhere inside the room', async ({ page }) => {
    const link = page.locator('.coquiet-support');
    await expect(link).toHaveText('Support us with a coffee');
    await expect(link).toHaveAttribute('target', '_blank');

    // A footer: at the foot of the screen, on the opposite side to the note it
    // shares the row with, and clear of the composition above it.
    const geometry = await page.evaluate(() => {
      const a = document.querySelector('.coquiet-support')!.getBoundingClientRect();
      const note = document.querySelector('.entry-footnote')!.getBoundingClientRect();
      const composition = document.querySelector('.entry-reassurance')!.getBoundingClientRect();
      return {
        gapBelow: window.innerHeight - a.bottom,
        rightOfNote: a.left - note.right,
        clearOfComposition: a.top - composition.bottom,
      };
    });
    expect(geometry.gapBelow).toBeLessThan(64);
    expect(geometry.rightOfNote).toBeGreaterThan(0);
    expect(geometry.clearOfComposition).toBeGreaterThan(20);
    // Opening a new tab without this hands the opener to the other origin.
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(1600);
    // A room built for concentration does not ask its visitors for anything
    // while they are concentrating.
    await expect(page.locator('.coquiet-support')).toHaveCount(0);
  });

  test('is reachable by keyboard and shows a focus ring', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Enter the room' })).toBeFocused();
    await page.keyboard.press('Tab');

    const link = page.locator('.coquiet-support');
    await expect(link).toBeFocused();
    const ring = await link.evaluate((el) => {
      const c = getComputedStyle(el);
      return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) };
    });
    expect(ring.style).not.toBe('none');
    expect(ring.width).toBeGreaterThan(0);
  });

  test('underlines at rest, so it reads as a link', async ({ page }) => {
    const link = page.locator('.coquiet-support');
    const decoration = () => link.evaluate((el) => getComputedStyle(el).textDecorationLine);

    expect(await decoration()).toBe('underline');

    // Hovering still strengthens it — brighter text, a stronger underline —
    // it just isn't the only signal that this line is clickable.
    const colorBefore = await link.evaluate((el) => getComputedStyle(el).color);
    await link.hover();
    await page.waitForTimeout(300);
    expect(await decoration()).toBe('underline');
    expect(await link.evaluate((el) => getComputedStyle(el).color)).not.toBe(colorBefore);
  });
});

test('the room never moves, however long the page has been open', async ({ page }) => {
  const framing = () =>
    page.evaluate(() => {
      const wrap = document.querySelector('.room-image-lqip')!;
      const img = wrap.querySelector('img')!.getBoundingClientRect();
      return {
        transform: getComputedStyle(wrap).transform,
        left: Math.round(img.left),
        top: Math.round(img.top),
      };
    });

  await page.waitForTimeout(1200);
  const onLoad = await framing();
  // A positional drift here restarted on every load, so where the photograph
  // sat depended on how long the tab had been open and a refresh snapped it.
  await page.waitForTimeout(6000);
  expect(await framing()).toEqual(onLoad);

  await page.reload();
  await page.waitForTimeout(1200);
  expect(await framing()).toEqual(onLoad);
  expect(onLoad.transform).toBe('none');
});

test.describe('the version chip', () => {
  const chip = (page: Page) => page.getByRole('button', { name: /^Version / });

  test('says the version and stays shut until it is asked', async ({ page }) => {
    await expect(chip(page)).toHaveText(/Version \d+\.\d+\.\d+/);
    await expect(chip(page)).toHaveAttribute('aria-expanded', 'false');

    // Last in the corner and last in the tab cycle: the door and the cup both
    // come first, because both matter more than what build this is.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(chip(page)).toBeFocused();

    // Drawn as the footer it belongs to, not as a control: no fill, no border.
    const drawing = await chip(page).evaluate((el) => {
      const c = getComputedStyle(el);
      const foot = getComputedStyle(document.querySelector('.entry-footnote')!);
      return {
        background: c.backgroundColor,
        border: c.borderTopWidth,
        matchesFooter: c.fontSize === foot.fontSize,
      };
    });
    expect(drawing.background).toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(drawing.border)).toBe(0);
    expect(drawing.matchesFooter).toBe(true);

    // A hover must not open it: it covers the headline, and nobody asked.
    await chip(page).hover();
    await page.waitForTimeout(400);
    await expect(page.locator('.version-panel')).toHaveCount(0);

    await chip(page).click();
    await expect(page.locator('.version-panel')).toBeVisible();
  });

  test('shows the last two releases, what is coming, and a way to ask', async ({ page }) => {
    await chip(page).click();
    const panel = page.locator('.version-panel');

    await expect(panel.locator('.version-release')).toHaveCount(2);
    // Newest first, and every release carries notes rather than a bare number.
    const numbers = await panel.locator('.version-release-no').allTextContents();
    expect(numbers).toHaveLength(2);
    expect(numbers[0]).not.toBe(numbers[1]);
    for (let i = 0; i < 2; i++) {
      expect(await panel.locator('.version-release-list li').nth(i).innerText()).not.toBe('');
    }

    await expect(panel.locator('.version-soon-title')).toHaveText([
      'New music genres',
      'More presence selections',
    ]);

    await expect(panel.locator('.version-request')).toHaveText(/Request a feature/);

    // Rises out of the corner, and its right edge is the corner's own margin.
    const fits = await panel.evaluate((el) => {
      const p = el.getBoundingClientRect();
      const trigger = document.querySelector('.version-chip')!.getBoundingClientRect();
      return {
        top: p.top,
        aboveTrigger: trigger.top - p.bottom,
        rightOffBy: Math.abs(p.right - trigger.right),
        scrollable: el.scrollHeight <= el.clientHeight || getComputedStyle(el).overflowY === 'auto',
      };
    });
    expect(fits.top).toBeGreaterThanOrEqual(0);
    expect(fits.aboveTrigger).toBeGreaterThan(0);
    expect(fits.rightOffBy).toBeLessThan(1);
    expect(fits.scrollable).toBe(true);
  });

  test('closes on Escape and hands focus back', async ({ page }) => {
    await chip(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.version-panel')).toBeVisible();

    // The one link inside is the next stop, not somewhere behind the panel.
    await page.keyboard.press('Tab');
    await expect(page.locator('.version-request')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('.version-panel')).toHaveCount(0);
    await expect(chip(page)).toBeFocused();
  });

  test('the request form is the other face of the panel, and forgets itself', async ({ page }) => {
    await chip(page).click();
    const panel = page.locator('.version-panel');
    await panel.locator('.version-request').click();

    // One face at a time: the notes give way rather than being pushed down
    // out of a panel that has nowhere to grow.
    await expect(panel.locator('.version-form')).toBeVisible();
    await expect(panel.locator('.version-release')).toHaveCount(0);

    // Two fields. The summary is optional; the request itself is not.
    const summary = panel.locator('.version-field input');
    const detail = panel.locator('.version-field textarea');
    await expect(summary).toBeVisible();
    await expect(detail).toHaveAttribute('required', '');
    expect(await summary.getAttribute('required')).toBeNull();

    // It says where the words are going before anyone types them.
    await expect(panel.locator('.version-form-foot p')).toContainText(/mail app/i);

    await summary.fill('A longer break');
    await panel.locator('.version-back').click();
    await expect(panel.locator('.version-release')).toHaveCount(2);

    // Closing the panel forgets the draft rather than keeping a stale one.
    await page.keyboard.press('Escape');
    await chip(page).click();
    await panel.locator('.version-request').click();
    await expect(panel.locator('.version-field input')).toHaveValue('');
  });

  test('is not carried into the room', async ({ page }) => {
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(1600);
    await expect(chip(page)).toHaveCount(0);
  });
});

/**
 * A filtered network — the office kind — does not fail the request. It answers
 * it, with a block page, and the media element reports that the same way it
 * reports a missing file. This was silent until the room learned to say so:
 * the engine set its `error` status and no component read it, so the visitor
 * got a play control that did nothing.
 */
test('a network that answers with a page instead of audio says so, and can be retried', async ({
  page,
}) => {
  let blocking = true;
  await page.route(/\.m4a(\?|$)/, async (route) => {
    if (!blocking) return route.continue();
    await route.fulfill({
      status: 403,
      contentType: 'text/html',
      body: '<html><body>Blocked by network policy</body></html>',
    });
  });

  await page.getByRole('button', { name: 'Enter the room' }).click();

  // Wait out the dissolve: until it finishes the room is still `inert`, and an
  // inert control is one Playwright will report as visible but refuse to focus.
  await expect(page.getByRole('button', { name: 'Enter the room' })).toHaveCount(0);

  await expect(page.getByText('The music won’t load here.')).toBeVisible();
  await expect(page.getByText(/Networks at work and school/)).toBeVisible();

  // The room itself is not broken — only the sound is missing.
  await expect(page.getByRole('radio', { name: 'Flow' })).toBeVisible();

  // Reachable and operable from the keyboard, like every other control here.
  const retry = page.getByRole('button', { name: 'Try again' });
  await retry.focus();
  await expect(retry).toBeFocused();

  // Let the file through and ask again: the message goes and the music starts.
  blocking = false;
  await retry.press('Enter');

  await expect(page.getByText('The music won’t load here.')).toHaveCount(0);
  await expect.poll(async () => (await deckState(page)).some((d) => !d.paused)).toBe(true);
});
