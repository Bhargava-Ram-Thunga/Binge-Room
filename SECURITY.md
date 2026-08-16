# Security Policy

## Supported Versions

Huddly is currently in active development. Security updates are applied directly to the `dev` and `main` branches.

| Version       | Supported          | Status             |
| :------------ | :----------------- | :----------------- |
| `0.1.x` (dev) | :white_check_mark: | Active Development |
| `< 0.1.0`     | :x:                | Unsupported        |

---

## Reporting a Vulnerability

We take the security of Huddly and our users seriously. If you believe you have discovered a security vulnerability in Huddly, please report it responsibly by following the steps below.

### 1. How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security issues through one of the following channels:

- **GitHub Security Advisory**: Open a private draft security advisory under the repository's [Security tab](https://github.com/Bhargava-Ram-Thunga/Huddly/security/advisories/new).
- **Direct Email**: Send encrypted or plain-text details to [bhargavaramthunga@gmail.com](mailto:bhargavaramthunga@gmail.com) with the subject prefix `[SECURITY REPORT]`.

### 2. Information to Include

To help us investigate and remediate the issue promptly, please include:

- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction steps or a minimal proof-of-concept.
- Affected components (e.g., `@huddly/realtime`, `@huddly/api`, `@huddly/protocol`).
- Any proposed mitigations or remediations if known.

---

## Response & Remediation SLA

When a security vulnerability is reported, the project maintainers commit to:

1. **Initial Acknowledgment**: Within **48 hours** of report receipt.
2. **Triage & Assessment**: Within **72 hours** to confirm severity and reproduction.
3. **Remediation & Patch**:
   - **Critical / High Severity**: Patch developed and released within **7 calendar days**.
   - **Medium / Low Severity**: Patch released in the next planned minor release.
4. **Public Disclosure**: Coordinated disclosure with the reporter after patches are validated.

---

## Automated Security Protections

The Huddly repository enforces automated defensive security controls:

- **Secret Scanning**: Gitleaks and GitHub Secret Scanning with Push Protection are enabled across all branches.
- **Dependency Scanning**: Dependabot automated weekly vulnerability monitoring and grouped updates.
- **Static Analysis (SAST)**: GitHub CodeQL analysis active on pull requests.
- **Input Validation**: Strict schema validation via Zod across all network envelopes and REST endpoints.
