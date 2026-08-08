# Upgrading convex-chat

`convex-chat` follows semantic versioning, but versions below `1.0.0` may include
documented breaking changes in a minor release. Always read the changelog and
upgrade notes before deploying a new version.

## Standard upgrade

1. Read every changelog entry between the installed and target versions.
2. Update `convex-chat` and `convex` together within their supported ranges.
3. Install with the repository's frozen package manager and inspect the lockfile.
4. Run Convex code generation, typechecking, component tests, and application
   tests from a clean checkout.
5. Deploy to a development Convex deployment containing representative data.
6. Exercise conversation listing, older-message pagination, sending and retrying,
   replies, edits, deletion, reactions, unread state, attachments, and presence.
7. Deploy the backend before clients that depend on an additive API, and monitor
   Convex errors and transaction conflicts during rollout.

## Compatibility rules

The following changes are behaviorally breaking even when TypeScript continues
to compile:

- authorization, membership visibility, or history-boundary changes;
- sequence allocation, pagination, or message-idempotency changes;
- unread arithmetic or read/delivery acknowledgement changes;
- reply, edit, deletion, reaction, or attachment-cleanup semantics;
- error-code changes; and
- a new required schema field or an index removed before all deployed code stops
  using it.

Breaking changes require a dated changelog entry, explicit before/after behavior,
host migration steps, deployment ordering, and a rollback boundary.

## Schema changes

Prefer a staged, additive migration:

1. Add optional fields and new indexes while old readers and writers remain valid.
2. Deploy dual-read or dual-write code when an existing representation changes.
3. Backfill in bounded, idempotent batches that can safely resume.
4. Measure completion and verify invariants on representative populated data.
5. Switch reads only after the backfill is complete.
6. Remove old fields or indexes in a later release after the rollback window.

Never combine adding a required field, backfilling all data, and removing the old
representation in one deployment. Conversation deletion and future lifecycle
jobs must likewise be bounded and resumable under Convex transaction limits.

## Rollback

Before deployment, identify the last version that can read every schema shape the
new version may write. A code rollback is safe only while that compatibility
holds. If a release begins writing data an older release cannot interpret, ship
forward-compatible readers first or provide a tested reverse migration.

Package downgrades do not automatically revert Convex schema or data. Preserve a
deployment snapshot or reproducible fixture for migration rehearsal, and never
delete data merely to make a rollback compile.

## Release rehearsal record

For every release that changes schema or durable semantics, record:

- source and target package and Convex versions;
- representative record counts and edge cases;
- migration duration, retries, failures, and database I/O;
- invariant checks before and after;
- client/backend deployment order; and
- the tested rollback or forward-fix procedure.

The initial `0.1.0` candidate does not require a data migration from the published
`0.0.1` placeholder because that package contained no component implementation.
