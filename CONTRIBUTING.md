# Contributing

Thanks for wanting to contribute. This document covers how changes land.
Development setup lives in [DEVELOPMENT.md](./DEVELOPMENT.md); rules for AI agents live in [AGENTS.md](./AGENTS.md).

## Ground Rules

- Smallest complete change that solves the requirement
- No unrelated cleanup mixed into feature changes
- No new dependencies without justification (see the guideline's dependency discipline)

## Reporting a Bug

PR-first for a personal repository: open a pull request with a minimal reproduction in `src/lib/report.json` (or a small JSON file) and what you expected instead.

- Search existing PRs first
- The reproduction must show the wrong render, not just describe it

## Proposing a Feature

Open an issue first when the feature changes the report.json contract — downstream skills compile against it.

## Pull Request Workflow

1. Branch from `main`
2. Implement; keep `mise run check` green
3. Commit messages follow Conventional Commits (validated by Cocogitto)
4. Open a PR; CI must pass
5. Review, then merge (squash merge unless otherwise stated)

## Review Expectations

Reviewers check:

- Correctness of the requested behavior
- No accidental scope creep, files, or dependencies
- Compatibility with architecture invariants in [ARCHITECTURE.md](./ARCHITECTURE.md)
- `docs/` updated in the same PR when the schema, components, or tokens changed
- No sensitive information

## Commit Conventions

Conventional Commits, enforced by Cocogitto locally and in CI:

```text
feat(chat): quote the selected passage in the transcript
fix(review): keep verdict tones consistent across items
```

With squash merging, the PR title must follow the same convention (it becomes the commit message).

## Pull Request Descriptions

Every pull request description must clearly include:

- **Purpose**: what the change is for
- **Impact**: what is affected
- **Context**: relevant background
- **Risks**: potential concerns
- **Testing**: validation performed and its results

Keep the GitHub pull request template synchronized with these five requirements.
