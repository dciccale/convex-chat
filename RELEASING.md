# Releasing convex-chat

Publishing changes npm state. Run the release workflow only with explicit
maintainer approval after the release-readiness checklist is satisfied.

## Prepare a candidate

1. Confirm `main` is green, the working tree is clean, and the compatibility
   matrix passed on Node 20 and 22 with minimum and current Convex versions.
2. Move every user-visible item from `Unreleased` into a dated version section.
3. Update `packages/convex-chat/package.json` to the intended version and refresh
   the lockfile without unrelated dependency changes.
4. Update `UPGRADING.md` for every behaviorally breaking change.
5. Run the release workflow with `dry-run` enabled and the `next` dist-tag.
6. Review the tarball, public API snapshot, npm dry-run output, and provenance
   configuration before approving publication.

## Publish a prerelease

Create the version commit and signed `v<version>` tag, push both, then run the
manual `release` workflow from `main` with `npm-tag=next` and `dry-run=false`.
The workflow requires the GitHub `npm` environment and npm trusted publishing to
be configured for this repository.

After publication, install the exact public version in a clean directory,
register the component, run Convex code generation against a development
deployment, and smoke-test an authenticated send and read.

## Publish `0.1.0` to `latest`

Only use `npm-tag=latest` for a non-prerelease package version after the release
candidate feedback window has closed with no unresolved critical or high-severity
defects. Verify the registry version before replacing alpha wording and badges.

## Recovery

Do not overwrite a published npm version. If publication is incorrect, deprecate
the affected version with an explanation, restore the intended dist-tag, and ship
a new patch or prerelease. Follow `UPGRADING.md` for any schema or durable-data
impact.
