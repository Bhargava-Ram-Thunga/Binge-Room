# Claude Code Integration Guide — Binge-Room

This document outlines how to effectively leverage **Claude Code** and its installed skills to develop, debug, and audit the **Binge-Room** monorepo.

---

## 🧠 Prompt Execution & Workflow Pipeline

When executing any task, you must adhere to the following sequence:

1. **Always Read Reference Files First:** Regardless of user prompts, **always** read both `CLAUDE.md` and `AGENTS.md` at the start of work to align on system rules, architecture, and coding guidelines.
2. **Skill Assessment:** Determine which specific global/project skills (e.g. `vibe-code-auditor`, `typescript-pro`) are needed for the task and follow their instructions.
3. **Decompose the Task:** Break down the request into smaller, manageable sub-tasks.
4. **Git Branching Strategy:**
   - Create a clean new branch from `dev` (e.g., `feat/jiohotstar` or `fix/firefox-sw`).
   - Implement the changes and verify them locally (running `pnpm build`, `pnpm lint`, and unit tests).
   - Once local verification succeeds, commit and push to the `dev` branch.
   - Run integration tests on `dev`.
   - **Only** push/merge to the `prod` branch when dev is fully verified and confirmed stable.

---

## 🛠 Active System Environment

- **Runtime:** Node.js (v20+)
- **Package Manager:** `pnpm` (v9+)
- **Monorepo Engine:** Turborepo
- **Key Services:** Redis (for session management) and Supabase (for persistent storage and auth)

---

## 🧭 Project-Specific Skills Directory

Your workspace has access to global and project skills. When working with Claude, you should instruct it to load or follow specific skills depending on the task:

### 1. Code Quality & Auditing

- **`vibe-code-auditor`**
  - **Purpose:** Audit rapidly generated or AI-produced code for structural flaws, fragility, and production risks.
  - **When to use:** Before merging new platform adapters, checking state machines, or review of server routing logic.
- **`web-quality-audit` & `production-code-audit`**
  - **Purpose:** Evaluate performance, error boundaries, and overall reliability.
  - **When to use:** Before deploying final builds of the Chrome extension or backend server.

### 2. Architecture & Type Safety

- **`typescript-pro` / `typescript-expert`**
  - **Purpose:** Help design strict TypeScript architectures, resolve complex generics, and optimize typing layouts.
  - **When to use:** Modifying `@binge-room/shared-types` or `@binge-room/platform-sdk` interfaces.
- **`zustand-store-ts`**
  - **Purpose:** Guide Zustand store design.
  - **When to use:** Editing state synchronization logic in the extension popup (`apps/extension/src/store`).

### 3. Extension & Browser API

- **`chrome-extension-developer` & `browser-extension-builder`**
  - **Purpose:** Manifest V3 specifications, service worker messaging, content script injection, and browser compatibility.
  - **When to use:** Working on `apps/extension` background or content scripts, handling cross-browser (Firefox) API differences.

### 4. UI & Styling

- **`tailwind-design-system` & `tailwind-patterns`**
  - **Purpose:** Modern CSS guidelines and design consistency.
  - **When to use:** Customizing the in-video room overlay or styling the Extension popup using Tailwind CSS.

### 5. Backend & Database

- **`nodejs-best-practices` & `nodejs-backend-patterns`**
  - **Purpose:** Real-time event architecture, Express routing, and error boundaries.
  - **When to use:** Reviewing or writing socket handlers in `apps/server/src/socket` or middleware.
- **`security-audit` & `security-auditor`**
  - **Purpose:** Audit security flaws, check CORS configs, verify Helmet setups, and check for SQL Injection or raw secrets.
  - **When to use:** Auditing the `.env` configuration, rate limiters, or Redis connection strings.

---

## 🚀 Claude Command Reference

Use the following Turborepo commands when prompting Claude to build, test, or check code in this repo:

### 📦 Install Dependencies

```bash
pnpm install
```

### ⚙️ Build the Monorepo

```bash
# Build all packages and apps (checks for type compilation)
pnpm build

# Build only the extension app
pnpm --filter @binge-room/extension build

# Build only the server app
pnpm --filter @binge-room/server build
```

### 🧪 Test & Lint

```bash
# Compile and check all TypeScript/Lints
pnpm lint

# Run all unit tests
pnpm test
```

### 💻 Running Locally (Development Mode)

```bash
# Start local Redis container
docker compose up redis -d

# Start dev server & extension watcher
pnpm dev
```

---

## 🔒 Security & Environment Rules

1. **Environment Variables:** All shared configurations reside in the root `.env` file. Do **not** commit this file. Only `.env.example` should be checked into Git.
2. **Secrets Scanning:** Use the `security-audit` skill to check for hardcoded API keys (e.g. Daily.co, Supabase keys) before staging git commits.
3. **Database Security:** Always verify that Supabase calls inside the backend go through proper access-control middleware.
