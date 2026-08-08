# Security review: 0.1 baseline

Review date: 2026-08-08

Scope: the `convex-chat` component, actor-scoped host helpers, Presence child
component integration, provider-neutral attachment descriptors, package exports,
and the example host boundary.

## Threat model

The component assumes the host authenticates callers and derives opaque scope
and subject identifiers from trusted server-side data. Clients are untrusted.
Attackers may guess Convex IDs, reuse identifiers across scopes, replay requests,
race mutations, submit oversized metadata, or act from an inactive or restricted
membership. Attachment bytes and provider credentials remain outside the
component.

## Evidence

- Component functions declare argument and return validators.
- The authorization matrix covers read/write, read-only, none, inactive,
  non-member, history-boundary, author, and cross-scope cases.
- Concurrency tests cover conversation creation, sequence allocation, retry
  deduplication, read-watermark monotonicity, and reaction replacement.
- Public text, identifier, pagination, membership, and attachment metadata are
  bounded and tested at invalid and upper-limit values.
- Deleted messages remove parts and reactions from public projections, while
  attachment storage keys are returned only after membership and authorship
  checks.
- Package creation excludes component test implementation files, and a clean
  consumer fixture typechecks the installed tarball and optional test export.

## Findings resolved during review

1. Reusing an external conversation key previously returned the existing ID even
   when kind, title, or membership differed. It now returns
   `IDEMPOTENCY_CONFLICT`, with regression and contention coverage.
2. Reusing a message client ID with identical parts but a different reply target
   previously returned the first message. Reply identity is now part of the
   idempotency contract and has regression coverage.
3. Several opaque identifiers and attachment metadata fields were unbounded.
   Public transaction-shaping inputs now have explicit, documented limits.
4. Warm Turbo output could hide resolution failures in nested component test
   registrars. Clean installation, uncached builds, package export checks, and a
   tarball-consumer test now exercise that boundary.

## Accepted boundaries

- Conversation creation is a trusted system API. Hosts must not expose it
  directly to clients or accept client-selected actor identifiers.
- Rate limiting, relationship policy, blocking, moderation, upload grants,
  storage-provider validation, and signed download URLs are host responsibilities.
- Presence room and session tokens are bearer capabilities. They must be treated
  as secrets and have no authority over durable chat data.
- Error messages are intended for development. Hosts should use stable error
  codes and avoid returning internal stack traces to end users.
- The demo identity switcher is intentionally insecure and is clearly labeled as
  unsuitable for production authentication.

## Remaining release checks

- Run the Node 20/22 and minimum/current Convex compatibility matrix in CI.
- Repeat this review whenever authorization, membership lifecycle, retention,
  admin deletion, or storage integration enters the supported contract.

## Dependency audit

The clean packed-consumer fixture audits the publishable production dependency
tree at high severity. The full workspace audit additionally reports two high
and one moderate denial-of-service advisories in Metro's `image-size` build-time
dependency for the Expo example. The advisories have no patched release, do not
enter the `convex-chat` tarball or runtime dependency tree, and only process
repository-controlled mobile assets during bundling. This is an accepted example
tooling risk; untrusted assets must not be added to the build inputs.

No unresolved critical or high-severity source findings were identified in this
review. Vulnerabilities should be reported privately as described in
`SECURITY.md`.
