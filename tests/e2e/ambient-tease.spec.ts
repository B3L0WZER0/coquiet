import { expect, test } from '@playwright/test';

/** Ambient is shown at the door before it opens: the switch is there, the choice is not. */
test('the door shows Music chosen and Ambient coming soon, with nothing to press', async ({ page }) => {
  await page.goto('/');
  const room = page.getByRole('group', { name: 'Room' });
  await expect(room.locator('[data-selected]')).toHaveText(/Music.*selected/);
  await expect(room.locator('[data-soon]')).toHaveText(/Ambient.*coming soon/);
  await expect(room.locator('button, a, [tabindex]')).toHaveCount(0);

  await room.locator('[data-soon]').click();
  await expect(room.locator('[data-selected]')).toHaveText(/Music/);
});
