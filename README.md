# SyncStream

> **Watch YouTube videos together — perfectly in sync.**

A production-grade, scalable watch party platform built as a Chrome Extension (Manifest V3) + real-time Node.js backend. Phase 1 supports YouTube; the platform-adapter architecture lets you add Netflix, Prime Video, Disney+, Twitch and more without touching the core engine.

---

## ✨ Features

| Feature | Status |
|---|---|
| YouTube playback sync (play/pause/seek) | ✅ Phase 1 |
| Room creation with 6-digit join code + invite link | ✅ Phase 1 |
| ±500ms drift correction | ✅ Phase 1 |
| Ad detection & peer pause during ads | ✅ Phase 1 |
| Animated toast notifications | ✅ Phase 1 |
| In-video overlay (room code + participant count) | ✅ Phase 1 |
| Auto-reconnect & state restoration | ✅ Phase 1 |
| Multi-platform adapters (Netflix, Prime…) | 🔜 Phase 3 |
| Voice/group chat | 🔜 Phase 3 |

---

## 🏗 Monorepo Structure

```
syncstream/
├── apps/
│   ├── extension/          # Chrome MV3 extension (React + Tailwind)
│   │   ├── src/
│   │   │   ├── background/ # Service worker — socket connection & room state
│   │   │   ├── content/    # Injected into YouTube pages
│   │   │   │   ├── youtube/  YouTubeAdapter
│   │   │   │   └── shared/   SyncEngine, ToastManager, RoomOverlay
│   │   │   ├── popup/      # React popup UI
│   │   │   ├── store/      # Zustand state (popup)
│   │   │   ├── services/   # roomService (messages → background)
│   │   │   └── hooks/      # useRoom hook
│   │   ├── public/
│   │   │   ├── manifest.json
│   │   │   └── icons/
│   │   └── scripts/
│   │       └── build.mjs   # esbuild (bg+content) + Vite (popup)
│   │
│   └── server/             # Node.js + Express + Socket.IO + Redis
│       └── src/
│           ├── socket/     # Socket.IO gateway (all event handlers)
│           ├── rooms/      # RoomService (CRUD)
│           ├── adapters/   # RedisAdapter
│           ├── middleware/ # SocketRateLimiter
│           ├── config/
│           └── utils/      # Logger (Winston)
│
└── packages/
    ├── shared-types/       # All TypeScript types & interfaces
    ├── shared-utils/       # Room code gen, drift math, debounce, etc.
    ├── event-schema/       # Socket event names & validation constants
    └── platform-sdk/       # PlatformAdapter interface + BaseAdapter
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)
- Docker + Docker Compose (for Redis)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Redis

```bash
docker compose up redis -d
```

### 3. Start the server

```bash
pnpm --filter @syncstream/server dev
```

Server runs on `http://localhost:4000`.  
Health check: `http://localhost:4000/health`

### 4. Build the extension

```bash
pnpm --filter @syncstream/extension build
```

Output: `apps/extension/dist/`

### 5. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `apps/extension/dist/`

---

## 🧩 How It Works

### Sync Flow

```
User presses PLAY on YouTube
      ↓
YouTubeAdapter.onPlay() fires
      ↓
SyncEngine emits VIDEO_EVENT → background SW
      ↓
Background SW emits socket PLAY event → server
      ↓
Server validates, updates Redis, broadcasts SYNC_UPDATE
      ↓
All peers' background SWs receive SYNC_UPDATE
      ↓
Each peer's content script receives SYNC_COMMAND
      ↓
SyncEngine.applySync() → YouTubeAdapter.play() (drift-corrected)
```

### Drift Correction

Every 5 seconds the `SyncEngine` computes the expected playback position:

```
expected = videoState.currentTime + (now - videoState.lastUpdated) / 1000
```

If `|actual − expected| > 500ms` it silently seeks to `expected`.

### Ad Synchronisation

When `YouTubeAdapter.isAdPlaying()` returns true, the adapter fires
`onAdStart`. SyncEngine tells the server → server tells all peers to
pause. When the ad ends, everyone resumes from the saved position.

---

## 🔌 Adding a New Platform

See [`docs/platform-adapters/adding-new-platform.md`](docs/platform-adapters/adding-new-platform.md).

TL;DR: extend `BaseAdapter`, implement ~10 methods, register with
`AdapterRegistry`, add `content_scripts` match to `manifest.json`.

---

## 🐳 Docker Deployment

```bash
# Build and start everything
docker compose up --build
```

Server is exposed on port `4000`. Configure `CLIENT_ORIGIN` in
`docker-compose.yml` to your Chrome extension ID in production.

---

## ⚙ Environment Variables (Server)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `CLIENT_ORIGIN` | `*` | CORS / Socket.IO allowed origins |
| `MAX_ROOM_USERS` | `20` | Participants per room |
| `ROOM_TTL_SECONDS` | `86400` | Room expiry (24 h) |

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Extension UI | React 18 + Tailwind CSS v3 + Zustand |
| Extension build | Vite (popup) + esbuild (bg + content) |
| Extension API | Chrome MV3 — Service Worker, Messaging, Storage |
| Real-time | Socket.IO v4 over WebSocket |
| Server | Node.js 20 + Express + TypeScript |
| Validation | Zod |
| State | Redis 7 (ioredis) |
| Logging | Winston |
| Monorepo | pnpm workspaces + Turborepo |
| Containers | Docker + Docker Compose |

---

## 🗺 Roadmap

- **Phase 2** — Improved drift correction, ad sync hardening, reconnection recovery
- **Phase 3** — Netflix, Prime Video, Disney+, Twitch adapters; voice & group chat
- **Phase 4** — Mobile, AI recommendations, public rooms, streaming analytics
