# convex-chat

Authorization-aware chat primitives for [Convex](https://www.convex.dev/).

[![CI](https://github.com/dciccale/convex-chat/actions/workflows/ci.yml/badge.svg)](https://github.com/dciccale/convex-chat/actions/workflows/ci.yml)
[![Convex Component](https://www.convex.dev/components/badge/convex-chat)](https://www.convex.dev/components/convex-chat)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![alpha](https://img.shields.io/badge/status-alpha-orange.svg)](CHANGELOG.md)

[Live demo](https://convex-chat.dev/) · [Documentation](https://convex-chat.dev/docs)

`convex-chat` is an independent Convex component for direct and small-group
human messaging. It owns the durable chat invariants—membership, ordering,
idempotency, unread state, message lifecycle, and presence—while your
application remains responsible for authentication, relationships, and product
policy.

> [!WARNING]
> This project is an early alpha. Its API and data model may change before the
> first stable release. Install the implementation from npm with
> `convex-chat@next`; the `latest` tag still points to the `0.0.1`
> name-reservation placeholder.

## Features

- Direct and group conversations with application-defined external keys
- Chat-local membership checks on every actor operation
- Ordered, idempotent sends with per-conversation sequence numbers
- Realtime history, conversation summaries, and exact unread counts
- Replies with deletion-safe quote snapshots
- Revision-safe edits and delete-for-everyone tombstones
- Allowlisted reactions
- Online presence and typing indicators
- Provider-neutral attachment descriptors with a direct Cloudflare R2 example
- Next.js and Expo/React Native examples with a deliberately fake identity
  switcher

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
    └── host-managed storage for attachment bytes
```

The component never decides whether two people are allowed to start a chat.
Your host application makes that product decision, creates the conversation,
and exposes only actor-scoped functions to clients. Host table IDs cross the
component boundary as opaque strings.

## Workspace

| Path                       | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `packages/convex-chat`     | Publishable Convex component and host helpers   |
| `packages/example-backend` | Shared private Convex backend for both examples |
| `apps/example`             | Runnable Next.js browser example                |
| `apps/example-native`      | Runnable Expo and React Native mobile example   |
| `apps/web`                 | Marketing website and Fumadocs documentation    |

## Run the example

You need Node.js 20 or newer, pnpm 10, and a Convex account for a development
deployment.

```sh
pnpm install
pnpm --filter convex-chat build:codegen
pnpm convex:dev
```

Keep the Convex process running. After the first CLI setup, copy its public
`CONVEX_URL` value into the two ignored frontend environment files:

```dotenv
# apps/example/.env.local
NEXT_PUBLIC_CONVEX_URL=https://your-development-deployment.convex.cloud

# apps/example-native/.env.local
EXPO_PUBLIC_CONVEX_URL=https://your-development-deployment.convex.cloud
```

Then start the browser frontend in another terminal:

```sh
pnpm dev:example
```

Open [http://localhost:3001](http://localhost:3001). On first use, the Convex
CLI asks you to select or create a project and writes deployment settings to
the ignored `packages/example-backend/.env.local` file.

To run the native client, start Metro in another terminal and scan its QR code
with Expo Go:

```sh
pnpm dev:example-native
```

The phone and development machine should normally share a network. If LAN
discovery is blocked, use
`pnpm --filter @convex-chat/example-native start --tunnel`. Select different
demo identities in the browser and phone to test realtime chat through the
same Convex deployment. Text, images, audio playback, and press-and-hold voice
recording work in Expo Go; no custom native build is required for this example.

The marketing and documentation site runs separately on
[http://localhost:3000](http://localhost:3000):

```sh
pnpm dev:web
```

The example lets you switch between Alice, Bob, and Charlie in the browser.
That is intentionally insecure demo plumbing; never accept `scopeId` or
`subjectId` from an untrusted client in a real application.

## Add the component to an application

Install `convex-chat@next` and register it in `convex/convex.config.ts`:

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
[`packages/example-backend/convex/chat.ts`](packages/example-backend/convex/chat.ts)
for a compact integration example and
[`packages/convex-chat/README.md`](packages/convex-chat/README.md)
for package-specific setup.

## Attachments

The component stores attachment descriptors, not binary data or provider
credentials. The host application authorizes uploads, resolves download URLs,
and deletes objects. The example integrates `@convex-dev/r2` directly while
keeping its upload grants and conversation authorization in host functions.

See [`apps/web/content/docs/guides/attachments.md`](apps/web/content/docs/guides/attachments.md) for the security model and R2
setup.

## Presence

The component composes `@convex-dev/presence` for ephemeral online and typing
state. Conversation membership is checked before presence operations, and
applications may omit the host wrappers when presence is disabled by product
policy.

See [`apps/web/content/docs/guides/presence.md`](apps/web/content/docs/guides/presence.md) for lifecycle, API, and privacy
details.

## Deploy the example

For Vercel Git integration, use `apps/example` as the project root and set a Convex
deploy key as `CONVEX_DEPLOY_KEY`. Use separate production and preview keys;
never reuse a production deploy key for previews. `apps/example/vercel.json`
contains the workspace-aware build command.

## Project status

The implemented alpha covers the features listed above. The maintained roadmap
distinguishes supported behavior from modeled groundwork and future work.

The original v0.1 design proposal and roadmap is in
[`apps/web/content/docs/reference/convex-chat-v0.1-prd.md`](apps/web/content/docs/reference/convex-chat-v0.1-prd.md). Changes since the
last release are tracked in [`CHANGELOG.md`](CHANGELOG.md).

The current feature boundary and prioritized roadmap are documented in
[`apps/web/content/docs/reference/roadmap.mdx`](apps/web/content/docs/reference/roadmap.mdx).
The concrete criteria for removing the alpha label are tracked in the
[`release-readiness checklist`](apps/web/content/docs/reference/release-readiness.mdx).
Upgrade and schema rollout practices are documented in
[`UPGRADING.md`](UPGRADING.md).
The frozen `0.1` behavior and package boundary are documented in the
[`supported contract`](apps/web/content/docs/reference/supported-contract.mdx).

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
Maintainer releases follow [`RELEASING.md`](RELEASING.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
