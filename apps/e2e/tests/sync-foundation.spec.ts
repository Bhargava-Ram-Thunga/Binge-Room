import { test, expect } from '@playwright/test';
import { createTwoClientSession } from '../helpers/two-client.js';

test.describe('Playback Synchronization Foundation (FOUND-008)', () => {
  test('host and guest both load the video fixture independently', async ({ browser }) => {
    const { hostPage, guestPage, cleanup } = await createTwoClientSession(browser);
    try {
      await hostPage.goto('/test-video.html');
      await guestPage.goto('/test-video.html');

      await expect(hostPage).toHaveTitle(/Huddly E2E Fixture/);
      await expect(guestPage).toHaveTitle(/Huddly E2E Fixture/);

      const hostTime = hostPage.locator('[data-testid="current-time"]');
      const guestTime = guestPage.locator('[data-testid="current-time"]');
      await expect(hostTime).toBeVisible();
      await expect(guestTime).toBeVisible();

      // Verify fixture controls
      const hostPlayBtn = hostPage.locator('[data-testid="play-btn"]');
      const guestPlayBtn = guestPage.locator('[data-testid="play-btn"]');
      await expect(hostPlayBtn).toBeVisible();
      await expect(guestPlayBtn).toBeVisible();
    } finally {
      await cleanup();
    }
  });
});
