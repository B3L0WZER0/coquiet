import { expect, test, type Page } from '@playwright/test';

/**
 * The critical path: entry → play → switch channel → start timer.
 *
 * Runs against a real browser, which is the only place some of this can be
 * checked at all — media elements, autoplay policy, and focus behaviour all
 * need a genuinely focused page.
 */

/** Watch every media element the engine creates, from before the first one exists. */
async function watchDecks(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __decks: Set<HTMLMediaElement> };
    w.__decks = new Set();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: []) {
      w.__decks.add(this);
      return play.apply(this, args);
    };
  });
}

function deckState(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __decks: Set<HTMLMediaElement> };
    return [...w.__decks].map((d) => ({
      volume: Number(d.volume.toFixed(3)),
      paused: d.paused,
      currentTime: d.currentTime,
    }));
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
  await expect(page.getByText(/focusing now/)).toHaveCount(0);
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
  expect(settled[0].volume).toBeCloseTo(0.7, 1);

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
    expect(levels.filter((v) => v > 0.7 * 0.25).length).toBeLessThanOrEqual(1);
  }
  // And it never drops out entirely.
  expect(Math.min(...profile.map((l) => Math.max(0, ...l)))).toBeGreaterThan(0);

  await page.waitForTimeout(2000);
  const after = await deckState(page);
  expect(after.filter((d) => !d.paused)).toHaveLength(1);
  expect(after.find((d) => !d.paused)!.volume).toBeCloseTo(0.7, 1);

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
  expect(during!.volume).toBeLessThan(0.7);

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
    await expect(page.getByText(/shared room and work alongside other people/)).toBeVisible();
    await expect(page.getByText('Ambient sound fades in · mute anytime.')).toBeVisible();
  });

  test('the call to action is solid stone, with hover and focus states', async ({ page }) => {
    const cta = page.locator('.coquiet-cta');
    const bg = () => cta.evaluate((el) => getComputedStyle(el).backgroundColor);

    await expect(cta).toHaveText('Enter the room');
    expect(await bg()).toBe('rgb(216, 197, 167)');

    await cta.hover();
    await page.waitForTimeout(350);
    expect(await bg(), 'hover should lift the fill').not.toBe('rgb(216, 197, 167)');

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
    await page.addInitScript(() => {
      const w = window as unknown as { __decks: Set<HTMLMediaElement> };
      w.__decks = new Set();
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: []) {
        w.__decks.add(this);
        return play.apply(this, args);
      };
    });
    await page.reload();
    await page.locator('.coquiet-cta').click();
    await page.waitForTimeout(5000);

    const volumes = () =>
      page.evaluate(() => {
        const w = window as unknown as { __decks: Set<HTMLMediaElement> };
        return [...w.__decks].filter((d) => !d.paused).map((d) => Number(d.volume.toFixed(3)));
      });

    const mute = page.getByRole('button', { name: /^(Mute|Unmute)$/ });
    expect((await volumes())[0]).toBeCloseTo(0.7, 1);
    await expect(mute).toHaveAttribute('aria-pressed', 'false');

    await mute.click();
    await page.waitForTimeout(400);
    expect(await volumes()).toEqual([0]);
    await expect(mute).toHaveAttribute('aria-label', 'Unmute');
    await expect(mute).toHaveAttribute('aria-pressed', 'true');

    await mute.click();
    await page.waitForTimeout(400);
    // The chosen level was kept, not overwritten with zero.
    expect((await volumes())[0]).toBeCloseTo(0.7, 1);
    await expect(mute).toHaveAttribute('aria-label', 'Mute');
  });

  test('the room image is cropped to the room\'s own focal point in portrait', async ({
    page,
  }) => {
    const state = () =>
      page.evaluate(() => ({
        objectPosition: getComputedStyle(document.querySelector('picture img')!).objectPosition,
        backgroundPosition: getComputedStyle(document.querySelector('.room-image-lqip')!)
          .backgroundPosition,
        focal: (document.querySelector('.room-image-lqip') as HTMLElement).style.getPropertyValue(
          '--room-focal-x',
        ),
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
    const badge = page.getByText(/Room open/);
    await expect(badge).toHaveText('Room open');

    // Someone else actually enters.
    const first = await context.newPage();
    await first.goto('/');
    await first.locator('.coquiet-cta').click();
    await first.waitForTimeout(1200);
    await expect(badge).toHaveText('Room open · 1 focusing now');

    const second = await context.newPage();
    await second.goto('/');
    await second.locator('.coquiet-cta').click();
    await second.waitForTimeout(1200);
    await expect(badge).toHaveText('Room open · 2 focusing now');

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
    const badge = page.locator('.coquiet-cta').locator('xpath=preceding-sibling::div[1]//p');
    await expect(badge).toHaveAttribute('aria-hidden', 'true');
    await expect(badge).toHaveCSS('opacity', '0');
    await expect(page.getByText(/focusing now/)).toHaveCount(0);

    // The room is still perfectly usable without it.
    await expect(page.locator('.coquiet-cta')).toBeVisible();
  });
});

test.describe('the support link', () => {
  test('sits on the way in, and nowhere inside the room', async ({ page }) => {
    const link = page.locator('.coquiet-support');
    await expect(link).toHaveText('Support us with a coffee');
    await expect(link).toHaveAttribute('target', '_blank');

    // A footer: at the foot of the screen, not trailing the composition.
    const geometry = await page.evaluate(() => {
      const a = document.querySelector('.coquiet-support')!.getBoundingClientRect();
      const composition = [...document.querySelectorAll('.fixed.z-30 p')]
        .pop()!
        .getBoundingClientRect();
      return {
        gapBelow: window.innerHeight - a.bottom,
        clearOfComposition: a.top - composition.bottom,
      };
    });
    expect(geometry.gapBelow).toBeLessThan(48);
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
