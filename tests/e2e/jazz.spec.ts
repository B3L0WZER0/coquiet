import { expect, test } from '@playwright/test';

/** The Jazz room: a third door, one channel, a kissa that changes with the hour. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('cleared')) return;
    localStorage.clear();
    sessionStorage.setItem('cleared', '1');
  });
});

test('the door offers Jazz, marked new, and shows the kissa silently', async ({ page }) => {
  await page.goto('/');
  const room = page.getByRole('radiogroup', { name: 'Room' });
  const jazz = room.getByRole('radio', { name: /Jazz/ });
  await expect(jazz).toContainText('New');
  await expect(jazz.locator('[lang="ja"]')).toHaveText('ジャズ');
  await jazz.click();
  await expect(jazz).toHaveAttribute('aria-checked', 'true');

  const scene = page.locator('.ambient-scene[data-jazz][data-active] img');
  await expect(scene).toBeVisible();
  await expect.poll(() => scene.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\/images\/jazz-/);
  expect(await page.evaluate(() => [...document.querySelectorAll('audio')].every((a) => a.paused))).toBe(true);
});

test('inside, Jazz is the only channel and it plays the jazz programme', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radiogroup', { name: 'Room' }).getByRole('radio', { name: /Jazz/ }).click();
  await page.getByRole('button', { name: 'Enter the room' }).click();

  const channel = page.getByRole('radiogroup', { name: 'Jazz' }).first();
  await expect(channel.getByRole('radio')).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const engine = (window as unknown as { __coquietEngine: { decks: { el: HTMLAudioElement }[] } })
          .__coquietEngine;
        return engine.decks.some((d) => !d.el.paused && /\/Jazz%20\d\.m4a$/.test(d.el.src));
      }),
    )
    .toBe(true);
});

test('/jazz/ opens on Jazz, preloads its scene and is its own page', async ({ page }) => {
  await page.goto('/jazz/');
  await expect(page).toHaveTitle(/Jazz/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/jazz\/$/);
  // The door's switch, not the room's own Jazz pill waiting behind it.
  const door = page.getByRole('radiogroup', { name: 'Room' });
  await expect(door.getByRole('radio', { name: /Jazz/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('link[rel="preload"][imagesrcset*="/images/jazz-"]').first()).toBeAttached();
  // The front door is still Music.
  await page.goto('/');
  await expect(page.getByRole('radio', { name: 'Music' })).toHaveAttribute('aria-checked', 'true');
});
