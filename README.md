# Huddly

<p align="center">
  <img src="docs/design/brand/logo.svg" alt="Huddly Logo" width="120" />
</p>

<p align="center">
  <strong>Watch together. Talk together. Stay on your own screen.</strong>
</p>

<p align="center">
  <a href="https://github.com/Bhargava-Ram-Thunga/Huddly/blob/dev/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-F2BB31?style=flat-square" alt="License: Apache 2.0" /></a>
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/Milestone-M0_Architecture-BF7118?style=flat-square" alt="Milestone: M0" /></a>
</p>

Huddly is an open-source realtime layer for being together on the web. Everyone
watches through their own browser, on their own device — Huddly synchronizes the
**experience**, not the screen.

🚧 **Early development.** Architecture is being finalized; see the
[roadmap](ROADMAP.md) and the [project board](https://github.com/users/Bhargava-Ram-Thunga/projects/3).

## Why not screen sharing?

Screen sharing pipes one person's pixels to everyone — heavy, blurry, and it
dies with their connection. Huddly instead distributes playback commands,
timestamps, and room state, so each participant's own browser plays their own
video, in sync.

## Documentation

- [MVP Scope & Definition of Done](docs/MVP.md) — frozen MVP feature scope and DoD
- [Realtime Protocol v1](docs/protocol/v1.md) — event envelope, catalog, and synchronization specs
- [Database Schema v1](docs/database/schema-v1.md) — relational architecture, ERD, and lifecycle rules
- [Brand Identity & Design Tokens](docs/design/brand/README.md) — visual system, palette, and tokens
- [ROADMAP.md](ROADMAP.md) — phases, milestones, MVP definition
- [CONTRIBUTING.md](CONTRIBUTING.md) — local setup and contribution guide
- [docs/adr/](docs/adr/) — architecture decision records
- [docs/process/board-automation.md](docs/process/board-automation.md) — how the board works

## License

[Apache License 2.0](LICENSE) — see [ADR-013](docs/adr/ADR-013-license.md) for
the reasoning.
