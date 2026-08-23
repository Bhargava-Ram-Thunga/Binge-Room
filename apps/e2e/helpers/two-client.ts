import type { Browser, Page, BrowserContext } from '@playwright/test';

export interface TwoClientSession {
  hostContext: BrowserContext;
  guestContext: BrowserContext;
  hostPage: Page;
  guestPage: Page;
  cleanup: () => Promise<void>;
}

/**
 * Creates two isolated browser contexts representing Host and Guest clients
 * watching a synchronized video stream in the same test.
 */
export async function createTwoClientSession(browser: Browser): Promise<TwoClientSession> {
  const hostContext: BrowserContext = await browser.newContext();
  const guestContext: BrowserContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  return {
    hostContext,
    guestContext,
    hostPage,
    guestPage,
    cleanup: async () => {
      await hostContext.close();
      await guestContext.close();
    },
  };
}
