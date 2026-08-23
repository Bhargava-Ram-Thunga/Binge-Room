# Huddly Testing Strategy & Guidelines

> **Target Code Coverage:** 80%+ across all packages  
> **Test Runner:** Vitest v4.1+ (Unit & Integration) | Playwright v1.49+ (E2E Multi-Client)

---

## 1. Test Pyramid & Methodology

```text
       ▲
      / \        E2E Tests (Playwright Multi-Context Browser Sync)
     /───\       Integration Tests (Fastify Route Injections & Database)
    /─────\      Unit Tests (Zod Envelopes, Drift Engine, Security Crypto)
   ─────────
```

- **Unit Tests:** Verify pure algorithmic and validation logic in `@huddly/protocol`, `@huddly/sync-engine`, `@huddly/ui`, and `@huddly/config`.
- **Integration Tests:** Test HTTP endpoints, JWT auth decorators, and Prisma delegate behavior in `@huddly/api` and `@huddly/database`.
- **Realtime Gateway Tests:** Validate WebSocket frame parsing, 25 msgs/sec rate limiting, and ticket single-use consumption in `@huddly/realtime`.
- **E2E Multi-Client Tests:** Validate multi-browser synchronized playback across two independent browser contexts (Host and Guest) in `@huddly/e2e`.

---

## 2. Running Tests

### Full Monorepo (Unit & Integration)

```bash
pnpm test
```

### Package-Specific

```bash
pnpm --filter @huddly/api test
pnpm --filter @huddly/realtime test
pnpm --filter @huddly/sync-engine test
pnpm --filter @huddly/database test
```

### Coverage Report

```bash
pnpm test:coverage
```

### Playwright E2E Tests (Multi-Client)

To install Playwright browser dependencies and run the E2E suite:

```bash
pnpm --filter @huddly/e2e exec playwright install --with-deps chromium firefox
pnpm --filter @huddly/e2e test
```

#### Two-Client Harness Pattern

All multi-client E2E tests should use the shared `createTwoClientSession` helper located in `apps/e2e/helpers/two-client.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { createTwoClientSession } from '../helpers/two-client.js';

test('playback state synchronizes from host to guest', async ({ browser }) => {
  const { hostPage, guestPage, cleanup } = await createTwoClientSession(browser);
  try {
    await hostPage.goto('/test-video.html');
    await guestPage.goto('/test-video.html');
    // Assert synchronized playback state
  } finally {
    await cleanup();
  }
});
```

---

## 3. Code Coverage Status & Goals

| Package               | Purpose                                | Target | Current Status                          |
| --------------------- | -------------------------------------- | ------ | --------------------------------------- |
| `@huddly/api`         | REST API, auth, rooms, tickets         | 80%+   | ✅ High coverage (106+ tests passing)   |
| `@huddly/database`    | Prisma schema, client delegates        | 80%+   | ✅ 100% delegate coverage               |
| `@huddly/protocol`    | Zod envelope schemas, validators       | 85%+   | ✅ 68/68 tests passing                  |
| `@huddly/sync-engine` | Drift measurement & tiered corrections | 85%+   | ✅ 42/42 tests passing                  |
| `@huddly/realtime`    | Fastify WS gateway, rate limiting      | 80%+   | ✅ 20/20 gateway tests passing          |
| `@huddly/config`      | Strict env validation                  | 80%+   | ✅ 10/10 env tests passing              |
| `@huddly/ui`          | Design tokens & swatches               | 80%+   | ✅ 4/4 token tests passing              |
| `@huddly/e2e`         | Playwright multi-client dual harness   | E2E    | ✅ Chromium & Firefox dual-client tests |

---

## 4. Continuous Integration (CI)

Every pull request against `dev` or `main` runs automated GitHub Actions workflows:

- **Lint & Format:** `eslint . && prettier --check .`
- **Strict Typecheck:** `tsc -b` across all workspace packages
- **Matrix Unit Tests:** Node.js 22 & 24 runners
- **E2E Tests:** Playwright multi-client suite on Chromium & Firefox
- **Secret Scanning:** `gitleaks`
- **CodeQL Analysis:** Static security vulnerability scanning
