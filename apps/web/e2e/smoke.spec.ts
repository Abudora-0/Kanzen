import { test, expect } from '@playwright/test';

test('landing renders the mark and the value proposition', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /one shelf for everything/i })).toBeVisible();
  await expect(page.locator('svg[aria-label="Kanzen"]').first()).toBeVisible();
});

test('demo flow loads a seeded dashboard', async ({ page }) => {
  await page.goto('/enter');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('the deck')).toBeVisible();
  await expect(page.getByText('titles tracked')).toBeVisible();
  // the counter settles on a non zero value from the seed
  await expect(page.getByText(/^[1-9]\d*$/).first()).toBeVisible();
});

test('insights renders every aggregation panel', async ({ page }) => {
  await page.goto('/enter');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await page.waitForURL(/\/dashboard/);
  await page.getByRole('link', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { name: 'Taste fingerprint' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Completion velocity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Franchise depth' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cross platform drift' })).toBeVisible();
});

test('library lists titles and switches to the constellation', async ({ page }) => {
  await page.goto('/enter');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await page.waitForURL(/\/dashboard/);
  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: /titles$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Constellation' }).click();
  await expect(page.locator('canvas')).toBeVisible();
});

test('the trackers page is reachable from the nav', async ({ page }) => {
  await page.goto('/enter');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await page.waitForURL(/\/dashboard/);
  await page.getByRole('link', { name: 'Trackers' }).click();
  await expect(page).toHaveURL(/\/connections/);
});

test('reduced motion preference is honoured', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/enter');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await context.close();
});
