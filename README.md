<div align="center">

  <img src="docs/design/brand/logo.svg" alt="Huddly Logo" width="140" height="140" />

# Huddly

**Watch together. Talk together. Stay on your own screen.**

An open-source realtime layer for being together on the web.<br />
Huddly synchronizes the **playback experience**, not the pixels.

  <br />

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-F2BB31.svg?style=flat-square)](LICENSE)
[![CI Status](https://img.shields.io/badge/CI-Passing-2E8540.svg?style=flat-square)](https://github.com/Bhargava-Ram-Thunga/Huddly/actions)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg?style=flat-square)](tsconfig.base.json)
[![Milestone: M0](https://img.shields.io/badge/Milestone-M0_Architecture-BF7118.svg?style=flat-square)](ROADMAP.md)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-000000.svg?style=flat-square)](turbo.json)

  <br />

<a href="#quick-start"><strong>Quick Start</strong></a> •
<a href="#why-huddly"><strong>Why Huddly?</strong></a> •
<a href="#features"><strong>Features</strong></a> •
<a href="#architecture"><strong>Architecture</strong></a> •
<a href="#development"><strong>Development</strong></a> •
<a href="docs/MVP.md"><strong>MVP Scope</strong></a>

  <br />
  <hr />
</div>

## Overview

Screen sharing forces one person's computer to compress and re-stream heavy video streams over WebRTC — resulting in blurry video, stuttering frame rates, high bandwidth costs, and dead connections.

**Huddly takes a fundamentally different approach:** each person watches native video in their own browser on their own device. Huddly's lightweight server distributes only playback timestamps, revisions, and room events ($< 15\text{ Kbps}$ per user), ensuring pristine **4K / HDR playback** with **$< 200\text{ ms}$ synchronization drift**.

```text
┌────────────────┐      WebSocket Playback Commands (<15 Kbps)      ┌────────────────┐
│  Host Browser  │ ───────────────────────────────────────────────► │ Server Machine │
│ (Native 4K/HDR)│                                                  │ (Revision Log) │
└────────────────┘                                                  └────────┬───────┘
        ▲                                                                    │
        │                       NTP Clock Sync & Drift Correction            │
        └────────────────────────────────────────────────────────────────────┴───────► ┌──────────────────────┐
                                                                                       │ Participant Browser  │
                                                                                       │ (Native 4K/HDR Sync) │
                                                                                       └──────────────────────┘
```

---

## Why Huddly?

| Dimension              | Screen Sharing (Discord / Zoom)      | Legacy Extensions      | **Huddly**                                           |
| :--------------------- | :----------------------------------- | :--------------------- | :--------------------------------------------------- |
| **Video Quality**      | Compressed 720p/1080p stream         | Site-dependent         | **Native 4K / HDR at display refresh rate**          |
| **Bandwidth Usage**    | $5\text{–}15\text{ Mbps}$ per viewer | Moderate               | **$< 15\text{ Kbps}$ (State synchronization only)**  |
| **Playback Precision** | Laggy, choppy audio sync             | Naive hard seeks       | **$< 200\text{ ms}$ drift with tiered rate-nudging** |
| **Site Support**       | Fragile capture                      | Whitelisted sites only | **Universal HTML5 video & audio engine**             |
| **Voice & Chat**       | Separate app required                | Text-only              | **Integrated LiveKit low-latency voice + chat**      |
| **Privacy & Security** | Streams user screen/desktop          | Broad host permissions | **Zero pixel streaming; server-verified roles**      |

---

## Features

- 🍿 **Universal HTML5 Engine:** Seamlessly detects and controls any `<video>` element on the web.
- ⚡ **Server-Authoritative Sync Engine:** Monotonic room revisions, NTP-style clock offset calculation, and tiered drift correction ($< 50\text{ms}$ pass $\to$ $\pm 5\%$ rate-nudge $\to$ hard seek).
- 🎙️ **Low-Latency Spatial Voice:** Crystal-clear voice chat powered by LiveKit SFU with active speaker detection.
- 💬 **Realtime Room Chat:** Low-latency sanitized messaging with emoji reactions, typing indicators, and moderation tools.
- 🔒 **Zero-Trust Role Enforcement:** Strict server-side verification — client claims of host status or permissions are never trusted.
- 🧩 **Cross-Browser WebExtension:** Single codebase targeting both Chrome and Firefox via Manifest V3.
- 🎨 **Cinema-Themed Design System:** Tailored OKLCH color tokens, golden-angle participant colors, and accessible WCAG AAA text pairings.

---

## Quick Start

### 1. Watch in 3 Steps

1. **Install Extension:** Load the Huddly extension in Chrome or Firefox (or open the web client).
2. **Create Room:** Navigate to any video on the web, click the Huddly icon, and select **Create Room**.
3. **Share Link:** Copy the invite link to your friends. When the host plays, pauses, or seeks, everyone's browser stays in lockstep.

---

## Architecture

Huddly is architected as a modular monolith in a pnpm monorepo:

```text
huddly/
├── apps/
│   ├── extension/          # Chrome & Firefox WebExtension (MV3)
│   └── web/                # React / TypeScript web client
├── packages/
│   ├── protocol/           # Versioned EventEnvelope, Zod schemas, error registry
│   ├── sync-engine/        # Server-authoritative drift measurement & correction
│   ├── browser-platform/   # Cross-browser extension runtime abstraction
│   ├── site-adapters/      # Universal HTML5 video adapter & fallback ladder
│   └── ui/                 # Shared UI components and OKLCH design tokens
├── services/
│   ├── api/                # Fastify / Node.js REST API (Auth, Rooms, Invites)
│   └── realtime/           # WebSocket server + Redis pub/sub state distribution
└── docs/                   # Specifications, ADRs, database ERD, and brand kit
```

---

## Development

### Prerequisites

- **Node.js**: $\ge 22.0.0$
- **pnpm**: $\ge 11.0.0$
- **Docker Compose**: For local PostgreSQL and Redis

### Setup & Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Bhargava-Ram-Thunga/Huddly.git
cd Huddly

# 2. Install dependencies across all packages
pnpm install

# 3. Start local PostgreSQL & Redis
docker compose up -d

# 4. Run tests and typechecks across the monorepo
pnpm test
pnpm typecheck
pnpm lint
```

---

## Documentation Hub

| Document                                              | Description                                                                            |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **[MVP Scope & DoD](docs/MVP.md)**                    | Frozen MVP feature boundaries, explicit non-goals, and Gherkin acceptance criteria.    |
| **[Realtime Protocol v1](docs/protocol/v1.md)**       | WebSocket envelope, event catalog, authorization matrix, and NTP clock sync formulas.  |
| **[Database Schema v1](docs/database/schema-v1.md)**  | PostgreSQL relational architecture, Mermaid ERD, hot queries, and GDPR erasure path.   |
| **[Brand Kit & Tokens](docs/design/brand/README.md)** | Logo assets, OKLCH popcorn palette, golden-angle participant colors, and WCAG ratings. |
| **[Release Plan](docs/process/release-plan.md)**      | Milestone schedule (M0–M12), release train targets, and the Slip Rule.                 |
| **[Architecture Decisions](docs/adr/)**               | Formal ADR records for all fundamental technical choices.                              |

---

## Contributing

We welcome contributions! Please review our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](docs/CODE_OF_CONDUCT.md) before opening a pull request.

- **Branch Protection:** All work happens on feature branches targeting `dev`. Direct commits to `dev`, `main`, or `prod` are rejected.
- **Commit Convention:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.).
- **Local Checks:** Ensure `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `npx markdownlint-cli2` pass prior to pushing.

---

## License

Distributed under the **Apache 2.0 License**. See [`LICENSE`](LICENSE) for more details.
