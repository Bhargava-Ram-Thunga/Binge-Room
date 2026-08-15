# ADR-013: Project license — Apache License 2.0

- **Status:** Accepted
- **Date:** 2026-08-15
- **Deciders:** Bhargava-Ram-Thunga
- **Issue:** [ARCH-015](https://github.com/Bhargava-Ram-Thunga/Huddly/issues/51)

## Context

Huddly is an open-source watch-together platform. The license has to serve four
goals at once, and they pull in different directions:

1. **Adapter ecosystem.** The strategic moat is community-contributed site
   adapters (spec §108). Contribution friction is an existential risk.
2. **Self-hosting.** Users must be able to run their own backend — a stated
   differentiator against Teleparty and friends.
3. **Corporate adoption.** Companies using Huddly internally (or bundling the
   protocol) widen the contributor pool.
4. **Future hosted offering.** A managed "Huddly Cloud" is a possible revenue
   path, and the open core must not be crippled to enable it (spec §66).

The project also touches WebRTC, codecs and media transport — a domain with
meaningful patent activity — so patent posture is not academic.

### Options considered

**MIT** — maximum adoption, minimum friction, universally understood. But it
grants no explicit patent license. In a WebRTC/codec-adjacent project, a
contributor could theoretically later assert patents over code they contributed.

**Apache License 2.0** — permissive like MIT, plus:

- an **express patent grant** from every contributor (§3), and
- a **patent retaliation clause**: assert a patent against the project and your
  own license terminates,
- explicit trademark and attribution handling (§6, §4).

Cost: slightly more ceremony (NOTICE file conventions, header expectations) and
a longer text than MIT.

**AGPL 3.0** — would stop a competitor running a closed, modified hosted fork.
But it is the strongest deterrent to exactly the audiences we need: many
companies ban AGPL dependencies outright, and network copyleft would attach to
anyone self-hosting a modified Huddly for their own users. For a project whose
value depends on volume of community adapters and on frictionless self-hosting,
this trades away our moat to defend against a threat that only matters if we
first succeed.

## Decision

**Huddly is licensed under the Apache License 2.0.**

The `LICENSE` file at the repository root carries the full text, copyright
attributed to "Huddly contributors" so that no CLA or copyright assignment is
required — contributors retain their copyright and license their contribution
under the same terms (Apache-2.0 §5).

## Consequences

**Positive**

- Contributors and companies get an explicit patent grant — important given the
  WebRTC/media surface.
- Compatible with the dependency stack (LiveKit is Apache-2.0; mediasoup is
  ISC; both compose cleanly).
- Apache-2.0 is GPLv3-compatible in the one direction that matters (our code can
  be used in GPLv3 projects), so we do not fragment the ecosystem.
- No CLA needed — §5 makes inbound contributions licensed on the same terms.

**Negative / accepted trade-offs**

- **We accept that a third party may run a closed hosted fork of Huddly.** This
  is the deliberate price of ecosystem growth. Our defence is execution, brand
  and the adapter registry — not license restrictions.
- Slightly heavier compliance ceremony than MIT (NOTICE conventions).

**Follow-through required**

- `license: "Apache-2.0"` in every published `package.json`.
- Third-party dependency licenses reviewed before public beta (M12); anything
  copyleft that would contaminate distribution gets flagged.
- If a hosted "Huddly Cloud" ships, proprietary control-plane pieces live in a
  **separate** repository — the open core stays genuinely useful (spec §66).

## Revisit when

- A hosted competitor materially free-rides on the project, **and** the
  community is large enough that an AGPL relicense would not kill it. Note a
  relicense would need agreement from all copyright holders — practically, this
  decision is close to permanent once external contributions land.
