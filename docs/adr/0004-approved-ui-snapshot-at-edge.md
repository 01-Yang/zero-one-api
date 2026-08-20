# ADR 0004: Serve the approved UI snapshot from the edge image

Status: Accepted

## Context

ADR 0001 separated the React Public Site from the Vue Console and originally
assigned Console releases to the Sub2API image. Production now has an additional
stability boundary: ordinary upstream upgrades must not change the approved UI
snapshot, even when the upstream Vue sources and embedded assets change.

The Zero One edge image already carries the reviewed recovered Console and
serves its explicit page and asset routes. Sub2API remains authoritative for
API behavior, authentication, authorization, persistence and unmatched route
fallbacks.

## Decision

The Edge image serves both the React Public Site and the immutable Approved UI
Snapshot for the documented Console routes. The snapshot is fixed by the
`ui-approved-*` tag and `.github/scripts/ui-baseline.json`; an upstream upgrade
may change only the named API/type compatibility paths without moving that tag.

Every Backend and Edge image in a Coherent Release is still built from the same
source commit. Backend migrations and API contracts are deployed and verified
first, followed by the matching Edge image. The recovered Console routing and
asset closure checks are release-blocking interfaces.

This decision supersedes only ADR 0001's consequence that Console changes are
served from the Sub2API image. It does not change ADR 0001's separation of React
and Vue, ADR 0002's exact-root routing boundary, or ADR 0003's same-commit and
Backend-first release requirements.

## Consequences

An upstream backend release can be adopted without an unreviewed visual change,
and rollback retains a known Console asset set. New upstream features that need
new Console controls remain unavailable in the protected snapshot until a
separate visual review creates a new immutable UI approval tag.
