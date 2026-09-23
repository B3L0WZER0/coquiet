import { expect, test } from '@playwright/test';

/** The Ambient room: chosen at the door, three scenes inside. */

test.beforeEach(async ({ page }) => {
  // Once per test, so a reload inside one still sees what it remembered.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('cleared')) return;
    localStorage.clear();
    sessionStorage.setItem('cleared', '1');
  });
});

test('the door offers Music and Ambient, and Ambient previews its landscape silently', async ({ page }) => {
  await page.goto('/');
  const room = page.getByRole('radiogroup', { name: 'Room' });
  await expect(room.getByRole('radio', { name: 'Music' })).toHaveAttribute('aria-checked', 'true');

  const ambient = room.getByRole('radio', { name: /Ambient/ });
  await expect(ambient).toContainText('New');
  await ambient.click();
  await expect(ambient).toHaveAttribute('aria-checked', 'true');

  await expect(page.locator('.ambient-backdrop')).toHaveAttribute('data-showing', '');
  const still = page.locator('.ambient-scene[data-active] img');
  await expect(still).toBeVisible();
  await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\/ambient\/coast-/);

  // Nothing audible before the door is opened.
  const audible = await page.evaluate(() => {
    const engine = (window as unknown as { __coquietEngine: { decks: { el: HTMLAudioElement }[] } })
      .__coquietEngine;
    return engine.decks.some((d) => !d.el.paused);
  });
  expect(audible).toBe(false);

  // One compact door, as before.
  await expect(page.getByRole('button', { name: 'Enter the room' })).toHaveCount(1);
});

test('inside, the three scenes switch sound and picture together', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /Ambient/ }).click();
  await page.getByRole('button', { name: 'Enter the room' }).click();

  const scenes = page.getByRole('radiogroup', { name: 'Ambient scene' }).first();
  await expect(scenes.getByRole('radio')).toHaveText(['Blue', 'Green', 'White']);
  await expect(scenes.locator('svg')).toHaveCount(3);

  await scenes.getByRole('radio', { name: 'Green' }).click();
  await expect(scenes.getByRole('radio', { name: 'Green' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.ambient-scene[data-active]')).toHaveAttribute('data-scene', 'forest');
  // The decks are never attached to the document; dev keeps the engine on window.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const engine = (window as unknown as { __coquietEngine: { decks: { el: HTMLAudioElement }[] } })
          .__coquietEngine;
        return engine.decks.some((d) => !d.el.paused && d.el.src.endsWith('/ambient/forest.m4a'));
      }),
    )
    .toBe(true);

  // Remembered for next time, and the door opens back onto Ambient.
  await page.reload();
  await expect(page.getByRole('radio', { name: /Ambient/ })).toHaveAttribute('aria-checked', 'true');
});

test('the room selector works from the keyboard', async ({ page }) => {
  await page.goto('/');
  const ambient = page.getByRole('radio', { name: /Ambient/ });
  // One tab stop, before the door; the arrows choose.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Music' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(ambient).toBeFocused();
  await expect(ambient).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Enter the room' })).toBeFocused();
  await ambient.focus();
  const outline = await ambient.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

test('/ambient/ opens the door on Ambient, silently, and is its own page', async ({ page }) => {
  await page.goto('/ambient/');
  await expect(page).toHaveTitle(/Ambient/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ambient\/$/);
  await expect(page.getByRole('radio', { name: /Ambient/ })).toHaveAttribute('aria-checked', 'true');
  // Nothing plays until the door is pressed.
  expect(await page.evaluate(() => [...document.querySelectorAll('audio')].every((a) => a.paused))).toBe(true);
  // Still a choice: the visitor can go back to Music.
  await page.getByRole('radio', { name: 'Music' }).click();
  await expect(page.getByRole('radio', { name: 'Music' })).toHaveAttribute('aria-checked', 'true');
});
