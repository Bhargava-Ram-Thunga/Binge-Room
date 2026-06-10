# AI Agent Coding Guidelines — Binge-Room

Welcome, Agent. This file provides context, rules of engagement, codebase architecture, and implementation details for the **Binge-Room** project. You must strictly follow these rules to ensure the codebase remains clean, compile-safe, and scalable.

---

## 💻 Tech Stack & Monorepo Architecture

Binge-Room is a pnpm monorepo organized as follows:

- **`apps/extension`**: Chrome Manifest V3 Extension (React 18, Tailwind CSS v3, Zustand state management, built with esbuild + Vite).
- **`apps/server`**: Socket.IO server (Node.js, Express, Winston logger, Zod schema validation, backed by Redis for quick room states).
- **`packages/shared-types`**: Core TypeScript types for events, user states, and rooms.
- **`packages/shared-utils`**: Common math and logic helpers (drift math, debounce, room code generator).
- **`packages/event-schema`**: Socket.IO event namespaces and validation schema.
- **`packages/platform-sdk`**: The Core Platform Adapter framework (`BaseAdapter`, `PlatformAdapter`, `AdapterRegistry`).

---

## 📐 Architecture & Coding Rules

### 1. Platform-Adapter Pattern

To synchronize video streaming platforms, we isolate platform-specific code from our core sync engine.

- **DO NOT** write platform-specific logic directly in the content scripts or background scripts.
- **DO** create a new platform adapter that extends `BaseAdapter` from `@binge-room/platform-sdk`.
- Implement all required methods (`play()`, `pause()`, `seek()`, `getCurrentTime()`, `isPlaying()`, `isAdPlaying()`, and event listener callbacks).
- Use `this.addDomListener` inside the adapter for target events. This ensures that when the user leaves a room, calling `destroy()` cleans up all DOM listeners to prevent memory leaks.
- Register the new adapter in the `AdapterRegistry`.

### 2. Strict Type Safety

- The monorepo has strict TypeScript enabled.
- Avoid using `any`. If a type is unknown, use `unknown` or cast it appropriately with type guards.
- Keep `@binge-room/shared-types` updated when introducing new message types or platform schemas.
- If you make changes in any package, run `pnpm build` immediately to verify there are no TypeScript compiler errors across workspace boundaries.

### 3. State & Sync Logic

- All popup UI state is maintained in a Zustand store.
- Real-time communication happens via WebSocket events validated through `@binge-room/event-schema`.
- Background service worker acts as the single source of truth for connection state and room information, passing commands to content scripts via chrome runtime messaging.

---

## 🔜 Next Phase: JioCinema, Hotstar, and Firefox Compatibility

### 1. JioCinema Integration (`jiocinema.com`)

- **Add Platform Type:** Add `'jiocinema'` to the `Platform` type in [shared-types](file:///Users/bhargavaramthunga/Projects/Binge-Room/packages/shared-types/src/index.ts).
- **Update Detector:** Update `AdapterRegistry.detect()` in [platform-sdk](file:///Users/bhargavaramthunga/Projects/Binge-Room/packages/platform-sdk/src/index.ts) to match `hostname.includes('jiocinema.com')`.
- **Create JioCinemaAdapter:**
  - Locate and target the primary HTML5 `<video>` element on JioCinema pages. Note: JioCinema uses dynamic classes and custom player wrapper components. Use resilient selectors (e.g., `document.querySelector('video')` or wait for player nodes).
  - Implement **Ad Detection (`isAdPlaying`)**: JioCinema serves ads using standard ad wrappers or client-side frames. Detect ads by looking for specific indicators in the DOM (e.g., countdown elements, skip buttons, ad overlays) or listening to player events that differ from standard playback.
- **Update Extension Manifest:** Add `*://*.jiocinema.com/*` to the `content_scripts` match array in the extension manifest.

### 2. Hotstar Integration (`hotstar.com`)

- **Add Platform Type:** Add `'hotstar'` to the `Platform` type in [shared-types](file:///Users/bhargavaramthunga/Projects/Binge-Room/packages/shared-types/src/index.ts).
- **Update Detector:** Update `AdapterRegistry.detect()` in [platform-sdk](file:///Users/bhargavaramthunga/Projects/Binge-Room/packages/platform-sdk/src/index.ts) to match `hostname.includes('hotstar.com')`.
- **Create HotstarAdapter:**
  - Identify video tags under Hotstar's custom player container (usually under classes like `.shanti-player` or `.video-container`).
  - Account for hotkeys and quality selectors that trigger native seek/reload events.
- **Update Extension Manifest:** Add `*://*.hotstar.com/*` to the `content_scripts` matches.

### 3. Firefox Compatibility & Cross-Browser Support

Chrome and Firefox handle Manifest V3 differently:

- **Background Event Page vs. Service Worker:** Firefox uses standard non-persistent background event pages instead of service workers:
  - Chrome manifest: `"background": { "service_worker": "background.js", "type": "module" }`
  - Firefox manifest: `"background": { "scripts": ["background.js"] }`
  - Build script modification: Ensure `apps/extension/scripts/build.mjs` outputs a manifest compatible with Firefox. You may create a script that generates a browser-specific manifest (e.g., `dist-chrome` and `dist-firefox`).
- **Namespace Polyfill:** Use a unified API layer. In Chrome, APIs use the `chrome` namespace. In Firefox, they use `browser`. Ensure the code uses browser-safe APIs or includes `webextension-polyfill` where necessary.
- **Firefox Content Scripts:** Ensure CSP (Content Security Policy) and message ports behave consistently across Gecko and Blink engines.

---

## 🕵️ Code Quality & Environment Audit Checklist (Vibe Code Auditor)

Before finishing any task, run the following audit:

1. **No Hardcoded Secrets:** Check that all URLs, API keys (Daily.co, Supabase), and DB URLs are pulled from environment variables (`.env`).
2. **Proper Error Handling:**
   - Database/Redis calls must be inside `try/catch` blocks.
   - Network fetches should specify a timeout.
   - Unhandled socket connections must be logged and shut down gracefully.
3. **Clean Up DOM Listeners:** Platform adapters must clean up their events when destroyed. Check that all listeners are wrapped in `this.addDomListener`.
4. **Performance:** Verify that Zustand state updates are selective and don't trigger unnecessary re-renders in the extension popup.
