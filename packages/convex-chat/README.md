# convex-chat

Authorization-aware direct and small-group chat primitives for Convex.

[Live demo](https://convex-chat.dev/) · [Documentation](https://convex-chat.dev/docs)

> [!WARNING]
> This package is an early alpha. Its API and data model may change before the
> first stable release. Install the implementation with `convex-chat@next`;
> the `latest` tag still points to the npm `0.0.1` name-reservation placeholder.

## What it provides

- Conversations and chat-local memberships
- Ordered, idempotent text and attachment messages
- Realtime history and exact unread counts
- Replies, revision-safe edits, tombstones, and reactions
- Presence and typing state
- Provider-neutral attachment metadata
- Host-side helpers that keep identity derivation in your application

## Install

```sh
pnpm add convex-chat@next convex
```

Register the component in `convex/convex.config.ts`:

```ts
import chat from "convex-chat/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(chat);

export default app;
```

Run `npx convex dev` to generate the component API. Your host functions can
then call `components.chat` directly or use the actor-scoped helpers:

```ts
import { exposeChatApi } from "convex-chat";
import { components } from "./_generated/api";

const api = exposeChatApi(components.chat, {
  authenticate: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Resolve these IDs from your own trusted application data.
    return resolveChatActor(identity);
  },
});

export const listConversations = api.listConversations;
export const listMessages = api.listMessages;
export const sendText = api.sendText;
```

Export the functions your client needs from that object, or use the same
pattern in custom queries and mutations. Conversation creation belongs in a
host-controlled mutation after the application has checked its relationship
and product-policy rules.

## Security boundary

The host application must authenticate every public caller and derive
`scopeId` and `subjectId` server-side. Never allow an untrusted client to choose
another user's subject ID. The component repeats chat-local membership checks
for actor operations even when the host wrapper has authenticated the caller.

Attachment bytes and storage credentials stay outside the component. The
host application can integrate Cloudflare R2, native Convex storage, S3, or
another provider without changing the durable chat model.

See the [repository README](https://github.com/dciccale/convex-chat#readme),
[presence guide](https://github.com/dciccale/convex-chat/blob/main/apps/web/content/docs/guides/presence.md),
[attachment guide](https://github.com/dciccale/convex-chat/blob/main/apps/web/content/docs/guides/attachments.md),
and [security policy](https://github.com/dciccale/convex-chat/security/policy)
for more detail.

## License

Apache-2.0
