# convex-chat

Authorization-aware chat primitives for [Convex](https://www.convex.dev/).

[![CI](https://github.com/dciccale/convex-chat/actions/workflows/ci.yml/badge.svg)](https://github.com/dciccale/convex-chat/actions/workflows/ci.yml)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![alpha](https://img.shields.io/badge/status-alpha-orange.svg)](CHANGELOG.md)

`convex-chat` is an independent Convex component for direct and small-group
human messaging. It owns the durable chat invariants—membership, ordering,
idempotency, unread state, message lifecycle, and presence—while your
application remains responsible for authentication, relationships, and product
policy.

> [!WARNING]
> This project is an early alpha. Its API and data model may change before the
> first stable release. It is not yet published to npm.

## Features

- Direct and group conversations with application-defined external keys
- Chat-local membership checks on every actor operation
- Ordered, idempotent sends with per-conversation sequence numbers
- Realtime history, conversation summaries, and exact unread counts
- Replies with deletion-safe quote snapshots
- Revision-safe edits and delete-for-everyone tombstones
- Allowlisted reactions
- Online presence and typing indicators
- Provider-neutral attachment descriptors and an optional Cloudflare R2 adapter
- A responsive Next.js example with a deliberately fake identity switcher

## How it fits together

```text
Your client
    │
    ▼
Your public Convex functions  ── authenticate and derive the actor
    │
    ▼
convex-chat component         ── enforce membership and chat invariants
    │
    └── optional storage adapter for attachment bytes
```

The component never decides whether two people are allowed to start a chat.
Your host application makes that product decision, creates the conversation,
and exposes only actor-scoped functions to clients. Host table IDs cross the
component boundary as opaque strings.

## Workspace

| Path                   | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `packages/convex-chat` | Publishable Convex component and host helpers |
| `packages/r2`          | Optional Cloudflare R2 attachment adapter     |
| `apps/web`             | Runnable Next.js and Convex example           |
| `docs`                 | Design contract and integration guidance      |

## Run the example

You need Node.js 20 or newer, pnpm 10, and a Convex account for a development
deployment.

```sh
pnpm install
pnpm --filter convex-chat build:codegen
pnpm convex:dev
```

Keep the Convex process running, then start the frontend in another terminal:

```sh
pnpm --filter @convex-chat/web dev
```

Open [http://localhost:3000](http://localhost:3000). On first use, the Convex
CLI will ask you to select or create a project and will write the deployment
settings to the ignored `apps/web/.env.local` file.

The example lets you switch between Alice, Bob, and Charlie in the browser.
That is intentionally insecure demo plumbing; never accept `scopeId` or
`subjectId` from an untrusted client in a real application.

## Add the component to an application

Until the first npm release, use a workspace checkout. Once published, install
`convex-chat` and register it in `convex/convex.config.ts`:

```ts
import chat from "convex-chat/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(chat);

export default app;
```

Then expose host functions that authenticate the caller and derive their
application scope and subject IDs. `exposeChatApi` provides a small set of
actor-scoped wrappers; applications can also write their own wrappers around
the generated component API.

Conversation creation should stay in host-controlled mutations, after your
application has checked its own relationship and policy rules. See
[`apps/web/convex/chat.ts`](apps/web/convex/chat.ts) for a compact integration
example and [`packages/convex-chat/README.md`](packages/convex-chat/README.md)
for package-specific setup.

## Attachments

The component stores attachment descriptors, not binary data or provider
credentials. The host application authorizes uploads, resolves download URLs,
and deletes objects. The optional `@convex-chat/r2` package implements this
contract with `@convex-dev/r2`.

See [`docs/attachments.md`](docs/attachments.md) for the security model and R2
setup.

## Presence

The component composes `@convex-dev/presence` for ephemeral online and typing
state. Conversation membership is checked before presence operations, and
applications may omit the host wrappers when presence is disabled by product
policy.

See [`docs/presence.md`](docs/presence.md) for lifecycle, API, and privacy
details.

## Deploy the example

For Vercel Git integration, use `apps/web` as the project root and set a Convex
deploy key as `CONVEX_DEPLOY_KEY`. Use separate production and preview keys;
never reuse a production deploy key for previews. `apps/web/vercel.json`
contains the workspace-aware build command.

## Project status

The implemented alpha covers the features listed above. Invitations and role
management, general data parts, configurable receipt privacy, manual unread,
lifecycle jobs, React Native helpers, and release hardening remain on the v0.1
roadmap.

The original v0.1 design proposal and roadmap is in
[`docs/convex-chat-v0.1-prd.md`](docs/convex-chat-v0.1-prd.md). Changes since the
last release are tracked in [`CHANGELOG.md`](CHANGELOG.md).

## Development

```sh
pnpm install
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
pnpm --filter convex-chat pack --pack-destination /tmp
```

Contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and
our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before opening a pull request.
Report security issues privately as described in [`SECURITY.md`](SECURITY.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
