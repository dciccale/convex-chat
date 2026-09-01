# Security policy

Please report vulnerabilities through a
[private GitHub security advisory](https://github.com/dciccale/convex-chat/security/advisories/new).
Do not open a public issue for a suspected vulnerability. Include the affected
version or commit, reproduction steps, impact, and any suggested mitigation.

This project does not yet have a formal support window. Maintainers will
acknowledge reports as soon as practical and will coordinate disclosure after a
fix is available.

Applications using this component must authenticate callers in host Convex
functions and derive `scopeId` and `subjectId` server-side. Never expose a host
wrapper that lets an untrusted client choose an arbitrary identity. The sample
application intentionally does this only to make switching demo users easy and
must not be copied into production authentication code.
