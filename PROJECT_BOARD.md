# Binge-Room Project Board

Real-time watch party platform project tracking board.

---

## 📅 Milestones & Deadlines

- **Phase 1 (Completed):** June 10, 2026
- **Phase 2 (Immediate Target):** June 24, 2026 (JioHotstar & Firefox Compatibility)
- **Phase 3 (Upcoming Target):** July 15, 2026 (Additional Platforms & Voice Chat)

---

## 🟢 DONE (Completed & Verified)

| Task ID    | Task Description                                                         | Component               | Completed Date |
| :--------- | :----------------------------------------------------------------------- | :---------------------- | :------------- |
| **BR-101** | Core Watch Party Socket Server bootstrap & Express setup                 | `apps/server`           | June 10, 2026  |
| **BR-102** | Redis adapter with transparent local in-memory fallback                  | `apps/server`           | June 10, 2026  |
| **BR-103** | Manifest V3 Chrome Extension popup UI, Zustand store & setup             | `apps/extension`        | June 10, 2026  |
| **BR-104** | Platform SDK Adapter abstract class and Adapter Registry system          | `packages/platform-sdk` | June 10, 2026  |
| **BR-105** | YouTube Platform Adapter (`YouTubeAdapter`) implementation               | `apps/extension`        | June 10, 2026  |
| **BR-106** | YouTube ad-detection overlay scanning (`isAdPlaying`) & pause sync       | `apps/extension`        | June 10, 2026  |
| **BR-107** | Client drift calculation math and automatic seek alignment               | `packages/shared-utils` | June 10, 2026  |
| **BR-108** | Setup project-specific `CLAUDE.md` and `AGENTS.md` guidelines            | Root                    | June 10, 2026  |
| **BR-109** | Resolve Platform SDK missing browser environment DOM typings             | `packages/platform-sdk` | June 10, 2026  |
| **BR-201** | Create Project Board and define Phase 2 tasks, milestones, and deadlines | Root                    | June 10, 2026  |
| **BR-209** | Setup GitHub Actions CI workflows for linting, building, and unit tests  | `.github/workflows`     | June 10, 2026  |

---

## 🟡 IN PROGRESS (Under Active Development)

| Task ID    | Task Description                                               | Component               | Target Date   |
| :--------- | :------------------------------------------------------------- | :---------------------- | :------------ |
| **BR-202** | Add `'jiohotstar'` platform type to `@binge-room/shared-types` | `packages/shared-types` | June 11, 2026 |

---

## 🔴 TODO (Backlog & Next Steps)

### Phase 2: JioHotstar & Firefox Compatibility (Deadline: June 24, 2026)

| Task ID    | Task Description                                                                       | Component               | Priority | Target Date   |
| :--------- | :------------------------------------------------------------------------------------- | :---------------------- | :------- | :------------ |
| **BR-203** | Update detector hostname parsing in `AdapterRegistry` to match `jiohotstar.com`        | `packages/platform-sdk` | High     | June 12, 2026 |
| **BR-204** | Create `JioHotstarAdapter` with resilient video selector & custom player state         | `apps/extension`        | High     | June 15, 2026 |
| **BR-205** | Implement ad detection indicators for `JioHotstarAdapter` (`isAdPlaying`)              | `apps/extension`        | High     | June 16, 2026 |
| **BR-206** | Update extension manifest match patterns to inject scripts on `*://*.jiohotstar.com/*` | `apps/extension`        | Medium   | June 16, 2026 |
| **BR-207** | Modify `build.mjs` build script to compile separate Chrome and Firefox manifests       | `apps/extension`        | High     | June 18, 2026 |
| **BR-208** | Implement unified API layer / polyfill (`webextension-polyfill`) for Gecko/Blink APIs  | `apps/extension`        | High     | June 20, 2026 |
| **BR-210** | Perform cross-browser testing (Chrome vs. Firefox) on `dev` branch                     | QA / Testing            | High     | June 24, 2026 |

### Phase 3 & Beyond: Voice Chat & Extra Platforms (Deadline: July 15, 2026)

| Task ID    | Task Description                                                    | Component        | Priority | Target Date   |
| :--------- | :------------------------------------------------------------------ | :--------------- | :------- | :------------ |
| **BR-301** | Netflix, Prime Video, Disney+, Twitch Platform Adapters integration | `apps/extension` | Medium   | July 05, 2026 |
| **BR-302** | Real-time Voice/Video group chat implementation using Daily.co SDK  | `apps/extension` | Medium   | July 15, 2026 |
