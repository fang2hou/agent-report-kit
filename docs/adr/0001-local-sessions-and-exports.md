# ADR-0001: Local SvelteKit sessions with standalone exports

- **Status**: accepted
- **Date**: 2026-10-19

## Context

The main use is a temporary local report for complex decisions, with form
answers and text-anchored discussion. Readers also need standalone HTML and
PDF for sharing. The previous static renderer required a separate HTTP script;
CLI and HTTP message writers could overwrite one another, and browser polling
kept abandoned services alive. The consumer skill and kit must evolve separately.

## Decision

Use one SvelteKit Node service for a local session, and export offline HTML and
PDF from shared components and the existing report.json contract.

Session routes use pathname routing and native server handlers. Export routes
use the static adapter, inline assets, and hash routing. Keep the CLI as a
lifecycle/API client. All writes belong to the service. Agent polling renews a
lease and acknowledges handled events; browser requests do not renew it.
Use a background collection subagent when available, otherwise the main agent
keeps polling. No harness-specific extension is required.

## Alternatives Considered

### Keep the standalone Node HTTP script

- Pros: smaller change; static-only build remains simple.
- Cons: duplicates serving and routing concerns already provided by SvelteKit.
- Why not chosen: local interaction is the primary experience, so native routes
  are worth maintaining a separate export build profile.

### Make every report a server-only application

- Pros: one build profile.
- Cons: exported files would depend on a running service.
- Why not chosen: standalone sharing is an explicit requirement.

### Require a pi extension for monitoring

- Pros: direct hooks into pi session exit and background work.
- Cons: adds a harness-specific requirement to a portable skill.
- Why not chosen: the main agent can poll while awaiting decisions; owner PID
  checks and a bounded lease provide service cleanup without an extension.

## Consequences

Components and theme have one implementation, and the skill calls explicit
commands for each output. Runtime state, consumption, and shutdown have one
owner. Two route shells/build profiles and a browser-based PDF command now need
validation. Offline exports cannot receive Agent replies. A stopped model
cannot listen: the collection agent must remain active. Unknown process
ownership uses bounded lease expiry rather than immediate exit detection.

## Review Triggers

Revisit if reports become multi-user or remotely hosted, or if supported
harnesses provide a common background-agent/session lifecycle API.
