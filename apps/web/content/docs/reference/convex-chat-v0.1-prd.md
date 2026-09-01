---
title: v0.1 design proposal
description: The original product requirements and implementation roadmap for convex-chat.
date: 2026-08-06
last_updated: 2026-08-07
status: DRAFT
target_version: 0.1.0
owner_repo: convex-chat
working_package_name: "convex-chat"
license_target: Apache-2.0
---

# Convex Chat Component v0.1 PRD and Implementation Plan

> [!NOTE]
> This is the original v0.1 design proposal and implementation roadmap. The
> repository README, package README, changelog, and exported types describe the
> implemented stable release.
>
> The maintained [supported contract](/docs/reference/supported-contract)
> supersedes proposal details that changed during implementation. In
> particular, an already-sent reply intentionally retains its bounded quote
> snapshot after its source is deleted.

## Executive Decision

Build `convex-chat` as an independent open-source Convex component for
application-to-application human messaging. Its reusable boundary is:

- conversations;
- chat-local membership, invitations, and roles;
- message persistence, ordering, pagination, and idempotency;
- read/unread watermarks, configurable delivery/read receipts, and a separate
  manual-unread attention marker;
- presence and typing state;
- message editing, deletion, reactions, replies/quotes, and conversation
  lifecycle; and
- post-commit events that host applications can use for push, email,
  moderation, analytics, or other side effects.

The component must not own application relationships such as coach/client,
doctor/patient, customer/support-agent, employee/team, friendship, tenancy, or
subscription entitlement. The host application owns those relationships and
maps them to component membership and access.

For example, a host application can keep its domain relationship canonical and
atomically project it into the component:

- active client and active coach: `read_write`;
- former client: `none`, so the thread is hidden and unreadable;
- former service provider: `read_only`, when host policy permits the narrow historical
  thread exception; and
- disabled identities: `none`.

This makes the component broadly reusable without weakening application-domain
authorization.

Version 0.1 is backend-first and text-first. It includes direct conversations,
small groups, known-subject invitations, owner/admin/member roles, ordered text
and host-defined data parts, realtime history, unread state, presence/typing,
editing, delete-for-everyone tombstones, reactions, single-message
replies/quotes, lifecycle APIs, and integration hooks. It does not include file
sharing, audio, calls, public discovery, invite links, per-user deletion,
nested reply threads, push delivery, or end-to-end encryption.

## Why This Should Be a Component

Convex makes the smallest chat demo trivial: insert a message and subscribe to
an indexed query. A production messaging domain is not trivial. Applications
repeatedly need to make the same decisions about:

- who may see a conversation and its history;
- how membership changes affect access;
- direct-message uniqueness and idempotent group creation;
- stable message order under retries and concurrent sends;
- unread counts and monotonically advancing read positions;
- presence expiry and typing indicators;
- optimistic sends without duplicate committed messages;
- group ownership and administrative invariants;
- redaction, account deletion, and retention;
- notification events that do not become the message source of truth; and
- future attachment storage without coupling chat to one object store.

Those rules are a coherent stateful abstraction. A component provides isolated
tables, runtime-validated APIs, reactive queries, nested transactional calls,
and a package boundary that can be tested independently of any one app.

## Ecosystem Investigation

Investigation was performed on 2026-08-06 and extended on 2026-08-07. The
conclusion is that the Convex
ecosystem contains valuable adjacent components, but no general-purpose
human-to-human chat component covering conversations, membership, messages,
unread state, and presence as one domain.

| Project or primitive          | What it provides                                                                                                                                                            | Decision for `convex-chat`                                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convex Components             | Isolated schemas/functions, reactive component queries, nested transactional calls, typed package APIs                                                                      | Use as the architectural foundation. Host wrappers remain the authentication boundary.                                                                                                                                                  |
| `@convex-dev/agent`           | AI-oriented threads/messages, streaming, model roles, tool calls, vector/text search, files, and human-agent examples                                                       | Study and reuse patterns, not the component itself. It does not own human conversation membership, group roles, unread state, or presence, and its AI message semantics are unnecessarily heavy for ordinary chat.                      |
| Vercel AI SDK `UIMessage`     | A UI-facing message envelope with typed metadata, ordered content/data/tool parts, part lifecycle state, streaming reconciliation, and framework hooks                      | Adopt the general message-parts architecture and naming lessons. Do not make the AI SDK package, full AI-specific union, or release cycle part of the 0.1 core. Document a future optional adapter.                                     |
| TanStack AI                   | A second typed `UIMessage`/`MessagePart` design spanning text, media, thinking, tool calls/results, structured output, and UI resources; its client architecture uses AG-UI | Treat this independent convergence as evidence for an ordered discriminated-part core. Do not add TanStack or agent execution dependencies to 0.1.                                                                                      |
| AG-UI                         | Vendor-neutral event protocol for streaming agent text, tool calls, state, interrupts, and custom events between agent runtimes and frontends                               | Consider as a future live-execution transport adapter. It is not durable human-chat storage, membership, unread, edit, or deletion semantics.                                                                                           |
| A2UI                          | JSON streaming protocol for declarative UI surfaces, separated data models, and client-owned component catalogs                                                             | Consider later for generated multi-component surfaces. Do not require it for ordinary inline app cards or allow generated UI to bypass the host renderer allowlist.                                                                     |
| MCP Apps                      | Standard extension linking tools to sandboxed `ui://` HTML resources with bidirectional tool/resource access and graceful text fallback                                     | Consider later for portable third-party mini-apps. It is heavier and less native than first-party React/React Native cards and is not part of 0.1.                                                                                      |
| Matrix events and relations   | Mature human-chat event envelopes, extensible event types, replies, replacements, reactions/aggregations, and fallback representations                                      | Reuse the lessons: durable event identity, explicit relations, versioned namespaced types, and meaningful fallback content. Do not implement the Matrix federation protocol.                                                            |
| `@convex-dev/presence`        | Efficient room presence, sessions, heartbeats, expiry, React and React Native hooks, and arbitrary per-user room data                                                       | Compose as a child component for online state and typing instead of rebuilding heartbeat expiry. Wrap it so callers cannot enter conversations they cannot read.                                                                        |
| `convex-unread-tracking`      | Community component for watermark-based unread tracking, subscriptions, sender mutes, groups, and React helpers                                                             | Use as design evidence. Implement the smaller invariant directly because chat owns message order and membership, and dual registration would create a second source of truth. Reconsider composition if its API becomes a stronger fit. |
| `@vllnt/convex-reactions`     | Community component for transaction-safe toggle reactions, counts, and paginated reactors on opaque resources                                                               | Use as design evidence. Keep chat reactions internal so membership authorization, source deletion, and message lifecycle remain one invariant boundary.                                                                                 |
| `@convex-dev/r2`              | Cloudflare R2 uploads, signed URLs, metadata synchronization, deletion, React/Svelte helpers                                                                                | Do not require it in 0.1. Design a future attachment adapter that can use R2, native Convex storage, or a host-managed store.                                                                                                           |
| Native Convex file storage    | Upload URLs, metadata, deletion, and component-local file storage                                                                                                           | A valid future default, but bearer download URLs require care when conversation access can be revoked.                                                                                                                                  |
| Convex full-text search       | Reactive, transactional, paginated message search with one search field and equality filters                                                                                | Defer public search to 0.2, but keep text in a dedicated indexed-compatible field.                                                                                                                                                      |
| Convex pagination and indexes | Cursor-based reactive pagination and ordered indexed reads                                                                                                                  | Use `convex-helpers` pagination inside the component because built-in reactive pagination has component-boundary limitations documented by Convex.                                                                                      |

The Components Directory did contain AI chat, WhatsApp transport, Presence,
Unread Tracking, notifications, and chatbot-message-hub entries. None was a
drop-in backend for first-party human DMs and groups. Both the unscoped npm name
`convex-chat` returned 404 from npm on the investigation date. A neutral scoped
fallback may be selected if needed; the package name and exported architecture
must not use a consuming application's brand. Availability must be checked
again immediately before creation or publication.

### Shared message/UI primitives: ecosystem conclusion

There is no single established primitive that simultaneously specifies:

- durable multi-user conversation storage and authorization;
- human edits, deletion, reactions, receipts, and membership;
- streamed agent execution, reasoning summaries, and tool-call state;
- typed application-owned rich components; and
- portable, sandboxed mini-apps.

The ecosystem is instead converging on compatible layers. AI SDK and TanStack
AI use ordered discriminated message parts as the render model. Convex Agent
projects one or more stored records into that model. AG-UI standardizes a live
agent-to-frontend event stream. A2UI describes declarative generated surfaces,
while MCP Apps packages interactive HTML resources for compatible hosts.
Matrix is the strongest adjacent reference for durable human-chat events and
relations.

`convex-chat` should therefore define the missing human/app-chat core and make
its boundaries adapter-friendly:

```text
durable conversation domain      convex-chat messages, membership, receipts
             |
             v
renderable message projection    ordered typed parts + metadata + fallbacks
             |
     +-------+--------------------+
     |                            |
     v                            v
AI execution adapter         rich-surface adapter
AI SDK / Convex Agent /       A2UI or sandboxed MCP Apps
TanStack AI / AG-UI           when the product truly needs them
```

This is deliberate interoperability, not a claim that `convex-chat` invents a
new universal protocol. Its durable schema must evolve more slowly than any AI
UI SDK. Adapters may track those SDKs independently and can be released under
separate entry points or packages.

The 0.1 product remains an agnostic, primarily human-to-human chat component in
the tradition of reusable Telegram- or WhatsApp-like conversation primitives.
Rich parts expand what a human message may carry; they do not turn the package
into an agent runtime. Application concepts, payload schemas, visual
components, commands, and business workflows always remain in the consuming
application. AI agents remain adjacent: an application may bridge one into a
conversation later, but `convex-chat` does not duplicate `@convex-dev/agent`.

## Inspiration From Mature Messaging Systems

This is not an attempt to reproduce WhatsApp or Telegram in 0.1. Their public
behavior still validates several foundational choices:

- per-conversation monotonically increasing message positions are useful for
  ordering, deduplication, gap handling, and read state;
- read state is naturally represented as a maximum read message/sequence that
  only moves forward;
- groups require explicit creator/admin/member semantics and safe ownership
  transfer;
- membership history and message history must remain distinct concepts; and
- granular media, moderation, invite-link, public-channel, and encryption
  features can be layered only if the core message and membership model leaves
  room for them.

`convex-chat` 0.1 intentionally chooses three fixed roles rather than
Telegram-scale granular rights. It also explicitly does not claim WhatsApp- or
Signal-equivalent privacy: server-side Convex data is not end-to-end encrypted.

## Goals

- Provide a reusable, authorization-aware backend focused on human-to-human DMs
  and small-group chat in Convex apps.
- Keep the host application's identity and business relationship model outside
  the component.
- Enforce chat-local membership and access inside every component operation.
- Make sends idempotent under mobile retries, optimistic UI, and reconnects.
- Provide deterministic per-conversation order and cursor-based history.
- Provide exact O(1) conversation unread counts through monotonic watermarks.
- Support realtime online/typing state without treating ephemeral presence as
  durable message history.
- Support ordered, versioned message parts and opaque host-defined data parts
  without importing or interpreting application-domain schemas.
- Expose a stable, brand-neutral UI-oriented projection and renderer-registry
  contract informed by AI SDK `UIMessage`, while keeping AI-specific roles,
  tools, reasoning, and streaming outside the 0.1 core.
- Support revision-safe editing, delete-for-everyone tombstones, realtime
  reactions, and same-conversation replies with trustworthy quote previews.
- Produce stable post-commit events for notifications and integrations.
- Preserve a path to attachments backed by native Convex storage, R2, or a
  custom store.
- Ship framework-neutral server APIs plus maintained React and React Native
  helpers for the essential realtime behavior.
- Maintain comprehensive tests, semantic versioning, upgrade guidance, and a
  minimal example application.

## Non-Goals for 0.1

- File, image, video, or audio-message upload and playback.
- Voice/video calls, live audio rooms, screen sharing, or WebRTC signaling.
- End-to-end encryption, disappearing messages, sealed senders, or key/device
  management.
- AI generation, tool execution, embeddings, RAG, model streaming orchestration,
  or agent memory. The message representation remains compatible with future
  adapters for these capabilities.
- Any application-domain part catalog, payload schema, visual component,
  interaction behavior, or business workflow. Hosts supply all of them.
- Public channels, usernames, directory discovery, federation, or cross-app
  messaging.
- Email/phone invite links, join-request queues, QR codes, or invitation
  delivery.
- Pins, forwards, polls, nested reply threads, or per-user “delete for me.”
- Push, browser push, SMS, email, webhook delivery, or OS badge management.
- Content moderation policy, malware scanning, abuse detection, or legal hold.
- A complete chat UI kit. Hooks and headless helpers are in scope; product
  styling is not.
- Arbitrary HTML/JavaScript message payloads, server-selected React components,
  or remote mini-app execution. A2UI/MCP Apps integration is future adapter
  work with an explicit sandbox and capability model.
- Arbitrary scale claims. Version 0.1 targets DMs and small groups and must be
  benchmark-driven before positioning itself for public groups or broadcast
  channels.

## Terminology

- **Subject**: an opaque, stable host identifier representing a user, service,
  bot, or other participant. The component never reads the host's users table.
- **Scope**: an opaque host security/tenancy partition. A subject and external
  key are interpreted inside one scope.
- **Conversation**: an enduring direct or group chat container.
- **Membership**: the chat-local relationship between a subject and a
  conversation.
- **Role**: `owner`, `admin`, or `member` within a group.
- **Access**: `read_write`, `read_only`, or `none`, independently controlled by
  the host or membership lifecycle.
- **External key**: a host-chosen idempotency key used to find or create the
  same logical conversation.
- **Context reference**: optional opaque provenance stamped on a message, such
  as a coaching relationship ID or support case ID.
- **Sequence**: a monotonically increasing integer ordering every durable item
  in a conversation.
- **Unread ordinal**: a monotonically increasing integer assigned only to items
  that count as unread.
- **Message part**: one ordered, independently identifiable unit inside a
  message bubble, such as text or an application-defined data object.
- **Data part**: a namespaced, versioned, host-validated structured payload
  whose renderer and behavior are owned by the consuming application.
- **Renderable message**: the authorized UI-facing projection of a durable
  message, including sender metadata, ordered parts, relations, lifecycle, and
  safe fallbacks. It is not necessarily identical to the stored row.
- **Surface**: a richer UI region with its own component tree or embedded app
  lifecycle. A surface is more capable than a normal message part and is not a
  0.1 primitive.
- **Reply**: a message-level reference to one earlier message in the same
  conversation.
- **Quote snapshot**: a bounded server-generated preview of the referenced
  message at the revision being replied to; clients cannot forge it.
- **Reaction**: an allowlisted short key, usually an emoji, with at most one
  active reaction per subject/message pair in 0.1.

## Ownership and Trust Model

### Component responsibilities

- persist conversations, memberships, messages, unread state, delivery/read
  watermarks, and manual-unread attention state;
- enforce membership access on reads and writes;
- enforce group role and ownership invariants;
- allocate message sequence and unread ordinal atomically;
- deduplicate sends by `(conversationId, authorSubjectId, clientMessageId)`;
- expose realtime, paginated, bounded queries;
- wrap child presence state with conversation access checks;
- edit messages with optimistic revision checks;
- delete message content into tombstones without breaking order, replies, or
  read watermarks;
- persist and aggregate realtime reactions;
- validate same-conversation reply references and generate quote snapshots;
- provide bounded conversation deletion and subject anonymization primitives;
- emit stable event envelopes through the host-side client wrapper; and
- validate all arguments and return values crossing the component boundary.

### Host application responsibilities

- authenticate every public caller;
- derive `scopeId` and `subjectId` server-side rather than trusting browser
  arguments;
- own users, profiles, tenants, coach/client or other domain relationships,
  entitlements, blocks, consent, and product policy;
- decide when a conversation should exist and map domain lifecycle to component
  membership access;
- register and validate allowed data-part types, schema versions, payloads, and
  renderers before calling the component or rendering returned data;
- rate-limit and moderate sends;
- decide whether read positions, online state, and typing are shown;
- deliver and deduplicate push/email/webhook side effects;
- implement UI and copy;
- define retention, privacy disclosures, legal basis, export, and account
  deletion behavior; and
- own future upload authorization, scanning, serving, and storage credentials.

### Authentication boundary

Component functions are called from host Convex functions. The browser must
never be allowed to select an arbitrary `subjectId` and call the component
without a host wrapper. The recommended wrapper pattern is:

```ts
export const sendMessage = mutation({
  args: {
    conversationId: v.string(),
    clientMessageId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { scopeId, subjectId } = await requireCurrentChatSubject(ctx);
    return chat.sendText(ctx, { scopeId, subjectId, ...args });
  },
});
```

The component then independently verifies that this subject has
`read_write` access to that conversation. This defense does not replace host
authentication, but it prevents ordinary component calls from bypassing
chat-local membership.

## Relationship Versus Membership Decision

Application relationships must remain in the host. Chat memberships must live
in the component.

Keeping all membership outside the component would force the host to authorize
every returned message after the component query and would make component-owned
realtime queries unsafe. Conversely, putting coach/client or other business
relationships inside a generic chat package would couple the component to one
product and make lifecycle changes ambiguous.

The bridge is an atomic projection. Convex documents that nested component
mutations participate transactionally in the parent mutation. A host can update
its relationship and call `chat.setMemberAccess` in the same mutation. If either
fails, both roll back.

Membership has two orthogonal dimensions:

1. Lifecycle: `invited | active | left | removed`.
2. Effective access: `read_write | read_only | none`.

This supports ordinary groups as well as application-controlled cases:

- invited group member: `invited + none`;
- active member: `active + read_write`;
- read-only announcement participant: `active + read_only`;
- departed member with no retained access: `left + none`;
- former coach allowed to inspect only shared messages: `active + read_only`;
- hidden former client thread: `active + none`.

The host-facing privileged access API requires an expected membership revision
to avoid stale lifecycle changes restoring access accidentally.

## V0.1 Functional Scope

### Conversations

- Create direct or group conversations.
- Idempotently create or retrieve a conversation by `(scopeId, externalKey)`.
- List the current subject's visible conversations reactively and with cursor
  pagination.
- Return last-message preview metadata without exposing redacted content.
- Archive a conversation globally through a privileged host operation.
- Direct conversations cannot add a third member through actor APIs.
- Group title is optional at the data layer; product UI may require it.

The component does not automatically enforce “only one DM for a pair,” because
many products need multiple contexts between the same people. The host may use
a canonical external key such as `dm:<lowerSubjectId>:<higherSubjectId>` when it
wants pair uniqueness, or a domain key such as
`coach:<clientId>:<coachId>` when continuity is domain-specific.

### Membership, invitations, and roles

- A direct conversation is provisioned with exactly two active members.
- A group has exactly one owner, zero or more admins, and members.
- Owners/admins may invite a known `subjectId`.
- Invited subjects may accept or decline their own invitation.
- Owners/admins may remove members; admins cannot remove or demote the owner.
- Only the owner may promote/demote admins in 0.1.
- Ownership must be transferred before the owner can leave.
- The last owner can never be removed by an actor operation.
- Host-privileged methods can provision or revoke access to reflect an external
  domain relationship, but their names must make bypass semantics explicit.
- Invites are chat-local records only. Tokens, links, email/SMS delivery,
  discovery, and proving ownership of an email address remain host concerns.

### Messages

- Send UTF-8 text through a convenience API that creates one `text` part.
- Send a bounded ordered list of parts so one message bubble can contain text
  plus one or more host-validated rich objects.
- Version 0.1 accepts `text`, namespaced `data`, and component-generated
  `system` parts. Media, tool, thinking, UI-resource, and declarative-surface
  parts are reserved for adapters or later versions.
- Create component-authored system messages for membership and lifecycle events
  when configured; bots and services use normal subject-authored messages.
- Persist author subject, optional context reference, client message ID,
  server timestamp, sequence, and unread ordinal.
- Allow an author to edit a text part in their own published message with
  `expectedRevision`; stale edits fail instead of overwriting newer content.
- Never allow one participant or group admin to edit another author's message.
- Record `revision`, `editedAt`, and `editedBySubjectId`. Version 0.1 does not
  retain previous message bodies; a host requiring content-level edit audit
  must capture it through its own authorized policy before exposing edits.
- Delete for everyone by replacing content with a durable tombstone while
  retaining message identity, order, author, reply relationships, revision,
  and timestamps. The public API calls this deletion; the storage operation is
  redaction.
- Allow authors to delete their own messages subject to host-configured policy.
- Allow group admins/owners or privileged host policy to delete messages, but
  never to edit their content.
- Allow a new message to reply to exactly one visible message from the same
  conversation. The component records `replyToMessageId` and generates a
  bounded quote snapshot from the referenced message's current revision.
- Keep the quote snapshot stable when the original is later edited. If the
  original is deleted, public readers see a deleted-message reply target rather
  than its preserved quote text.
- Support one active allowlisted reaction per subject/message. Selecting the
  same key toggles it off; selecting a different key replaces it atomically.
  Reactions update reactively and do not create message sequences, unread
  ordinals, or notification events unless the host opts into reaction events.
- Reject edits, reactions, and new replies to deleted messages.
- If the edited/deleted message is the conversation's current last message,
  update or clear its public preview in the same mutation. Older-message
  changes do not reorder the inbox.
- List messages newest-first with cursor pagination; headless client helpers may
  reverse pages for rendering.
- Offer a bounded “around sequence” query for deep links in a later 0.1 minor
  only if it can be added without destabilizing initial pagination.

### Renderable message and rich-part architecture

`convex-chat` is application chat, not only a WhatsApp-style text transport.
A consuming application may allow participants to share structured domain
objects or render interactive components inside a message. Those objects,
schemas, renderers, actions, and business meanings are never part of
`convex-chat`; the component supplies only an opaque, validated transport and
projection primitive. Component-generated conversation lifecycle notices may
also appear without impersonating a human. The core model must leave room for
bots and agent adapters without making them a 0.1 responsibility.

The canonical content shape is an ordered discriminated union inspired by AI
SDK `UIMessage.parts`, Convex Agent's `MessageDoc` to `UIMessage` projection,
and TanStack AI's `MessagePart`:

```ts
type ChatMessagePart =
  | {
      id: string;
      type: "text";
      text: string;
    }
  | {
      id: string;
      type: "data";
      dataType: string; // host namespace, e.g. "com.example.resource"
      schemaVersion: number;
      data: Value;
      fallbackText: string;
    }
  | {
      id: string;
      type: "system";
      systemType: string; // namespaced lifecycle event
      schemaVersion: number;
      data?: Value;
      fallbackText: string;
    };
```

Every part has a stable ID unique within its message and a deterministic order
from its array position. Namespaced type plus integer schema version identifies
the payload contract. `fallbackText` is required for non-text parts so older,
minimal, notification, export, and accessibility clients can communicate the
essential meaning without knowing the rich renderer. The component validates
the common envelope, supported base part types, identifiers, aggregate size,
and configured type allowlist. The host wrapper validates each data payload
against the application schema before crossing the component boundary.

A UI query returns a `ChatUIMessage`, not the internal database row:

```ts
type ValueOf<T> = T[keyof T];

type ChatUIMessagePart<TDataParts extends Record<string, unknown>> =
  | { id: string; type: "text"; text: string }
  | ValueOf<{
      [Name in keyof TDataParts & string]: {
        id: string;
        type: `data-${Name}`;
        schemaVersion: number;
        data: TDataParts[Name];
        fallbackText: string;
      };
    }>
  | {
      id: string;
      type: "system";
      systemType: string;
      schemaVersion: number;
      data?: unknown;
      fallbackText: string;
    };

type ChatUIMessage<
  TDataParts extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: string;
  sequence: number;
  sender: { type: "subject"; subjectId: string } | { type: "system" };
  parts: ChatUIMessagePart<TDataParts>[];
  metadata: {
    createdAt: number;
    revision: number;
    editedAt?: number;
    status: "published" | "redacted";
  };
  reply?: RenderableReplyReference;
};

type ChatMessageView<TDataParts extends Record<string, unknown>> = {
  message: ChatUIMessage<TDataParts>;
  reactions: ReactionSummary[];
  permissions: MessagePermissions;
  receipt?: MessageReceiptSummary;
};
```

Message parts contain only renderable content. Sender identity, ordering,
revision, deletion status, and reply relation belong to the message envelope.
Reactions and per-viewer permissions may be joined into a convenient
`ChatMessageView`, but are not parts. Delivery/read receipts and unread state
remain membership/conversation state and are queried independently; editing
changes the envelope revision and selected content, not the part vocabulary.
This separation prevents rich-content interoperability from becoming coupled
to the rest of the human-chat feature model.

The shape intentionally follows the useful separation in AI SDK—message
metadata versus ordered renderable parts—without directly extending
`UIMessage`. AI roles such as `user`, `assistant`, `system`, and `tool` do not
identify arbitrary humans, coaches, clients, bots, or services and can be
relative to the current viewer. The durable component therefore uses sender
identity and provenance.

Version 0.1 does not import or depend on `ai`. A future optional adapter can
accept a host-supplied role resolver and project compatible parts into AI SDK
`UIMessage`. Such an adapter may import `UIMessagePart` directly and declare
`ai` as its peer dependency, but that dependency must not leak into the core
package. A future Convex Agent bridge can compose agent output into an
application timeline without making Agent storage the human-chat source of
truth.

#### AI SDK type-dependency decision

AI SDK exports `UIMessagePart`, `UIDataTypes`, `UITools`, individual UI part
types, and runtime UI-message validation helpers from `ai`. A type-only import
is technically possible and disappears from emitted JavaScript. However, if a
public declaration in the core package refers to those types, TypeScript
consumers must still resolve an installed compatible `ai` package. The full
union also includes AI-specific reasoning, step, source, and tool lifecycle
semantics that ordinary human chat neither needs nor should implicitly accept.

Therefore 0.1 defines its own small, brand-neutral `ChatMessagePart` wire
contract for `text`, host-defined `data`, and component-generated `system`
parts. It is structurally inspired by and intentionally mappable to
`UIMessagePart`, but structural similarity is not a promise of perpetual type
identity. The core package has no `ai` dependency, peer dependency, or exported
type reference. A future separately versioned adapter may import
`UIMessagePart` directly, depend on `ai` as a peer, map supported parts in both
directions, and preserve unsupported AI-only state without expanding the core
component's responsibilities.

#### Renderer registry

Rendering remains client-owned, but the component package should define the
typed registration contract and unknown-part fallback behavior:

```ts
const chatParts = defineChatParts({
  "com.example.resource": {
    schemaVersion: 1,
    schema: applicationPartSchema,
    render: ApplicationPartRenderer,
    fallback: ({ fallbackText }) => fallbackText,
  },
});
```

The server schema, client renderer, notification formatter, export formatter,
and migration/upcaster should be registered from the same logical part
definition where framework boundaries permit it. React and React Native can
provide different renderers for the same wire part. An unknown or unsupported
version never executes arbitrary code: it renders a safe fallback and retains
the original bounded data for a newer client.

#### Actions, tools, and authoritative application state

A rich part may offer application-defined actions. The part describes the UI
and references application state; it does not grant authority and it is not
itself the command execution engine. Every interaction calls a host application
function that re-authenticates the subject, re-checks conversation and domain
authorization, validates current state, and uses an idempotency key. The UI
then reacts to authoritative application state according to product policy.

This same primitive can later represent an AI tool or human-in-the-loop
request, but tool-call lifecycle is an adapter concern. AI SDK, TanStack AI,
and AG-UI have richer states for streaming input, awaiting approval, output,
errors, cancellation, and resumption. `convex-chat` must not flatten those into
a misleading generic `status` in 0.1. Instead, future adapters may expose
namespaced part types and states while preserving their protocol identifiers.

#### Durable, provisional, and transient state

The architecture distinguishes:

1. **Durable message state**: published parts, edits, tombstones, replies, and
   reactions that survive reload and participate in history.
2. **Provisional message state**: a future bot/agent message being streamed and
   reconciled by stable message/part IDs before it becomes complete.
3. **Transient conversation state**: typing, progress hints, connection state,
   and disposable notices that should not enter message history.

Version 0.1 implements durable state and presence-based transient state. It
reserves stable IDs and projection boundaries for provisional streaming but
does not implement a generation runtime. If streaming is added, unread and
notification effects occur at a documented publication boundary, not once per
token or part delta. “Thinking” UI must represent an intentionally shareable
status or summary, never assume access to or persist private model chain of
thought.

#### When a part is not enough

Inline first-party cards should use data parts and native host renderers. A2UI
is relevant when a server or model needs to progressively describe a bounded
component tree backed by a client-owned catalog. MCP Apps is relevant when a
portable third-party interactive application needs an isolated HTML runtime,
capability negotiation, CSP, and bidirectional tool calls. These are future
surface adapters, not alternate ways to inject HTML into `data` parts.

All rich content follows progressive enhancement: meaningful text fallback,
then a registered native renderer, then—only where explicitly supported and
sandboxed—a richer surface. Conversation history, membership, receipts, and
message identity remain owned by `convex-chat` at every level.

Text limits must be configurable in the host-side `Chat` client, with a safe
default. Proposed defaults:

- text: 10,000 Unicode code points;
- group membership: 100 subjects, pending benchmark validation;
- `clientMessageId`: 128 bytes;
- namespaced `dataType` or `systemType`: 64 bytes;
- parts per message: 16;
- reaction key: 32 bytes and an allowlist configurable by the host;
- quote snapshot text: 280 Unicode code points;
- aggregate message parts: 16 KiB measured with Convex serialization, excluding
  common message envelope fields; and
- context reference: 256 bytes.

Edit/delete time windows are host product policy. The component accepts optional
limits in the host-side `Chat` configuration and always enforces authorship,
role, current status, and expected revision. A privileged `system*` operation
can apply stricter domain/legal policy without pretending to be the author.

“Delete for me” is deliberately separate from delete for everyone. It would
require per-subject message visibility records and different export/unread
semantics, so it is deferred beyond 0.1.

### Idempotent send

Every client send requires a stable `clientMessageId`, normally a UUID created
before optimistic rendering. The component checks the unique logical key:

```text
(conversationId, authorSubjectId, clientMessageId)
```

The first successful call creates the message. A retry with identical parts,
relations, and context returns the original message. A retry that reuses the ID
with different content throws a typed conflict error. Post-commit event IDs
derive from the committed message ID, so retries cannot create duplicate
notification events.

### Message ordering

Each conversation keeps one `nextSequence` counter. A send mutation reads and
increments it while inserting the message. Convex's serializable mutation model
provides one committed order under concurrent sends.

The same mutation updates `inboxUpdatedAt` on every visible membership so each
subject's conversation list can be indexed and sorted by latest activity. This
is bounded fan-out and is another reason 0.1 has a configurable small-group cap.
Avoiding that fan-out at large-group scale would require a different inbox/read
model and is future work.

This creates a hot document for a very high-volume room. That is an accepted
0.1 tradeoff for exact ordering and O(1) unread counts in DMs/small groups. The
implementation must benchmark contention and document an evidence-based
operating envelope before release. Public channels, high-volume broadcasts, or
very large groups require a separate ordering design and are not implied by
0.1.

### Read watermarks and unread counts

Every message that should count as unread receives both:

- `sequence`: order among all durable conversation items; and
- `unreadOrdinal`: order among unread-counting items only.

The conversation stores `lastUnreadOrdinal`. Each membership stores
`lastReadSequence` and `lastReadUnreadOrdinal`. Unread count is:

```text
max(0, conversation.lastUnreadOrdinal - membership.lastReadUnreadOrdinal)
```

`markReadThrough(sequence)` resolves the greatest unread ordinal at or before
that sequence and advances both watermarks monotonically. It can never move
backward. Sending a message advances the sender's watermark through their own
new message, reflecting that a sender was viewing the conversation.

This mechanism powers unread counts regardless of whether the host exposes
participant read receipts. Receipt summaries and participant-detail queries are
separate from the subject's own unread APIs and obey the configured privacy
mode.

Redacted messages retain their unread ordinal. If redacted before a recipient
views the conversation, the recipient may still have an unread item until they
open/mark the conversation; the UI renders a tombstone. This preserves simple,
monotonic accounting.

Editing, deletion, and reaction changes do not allocate a new sequence or
unread ordinal and do not move anyone's read watermark. A reply is a normal new
message, so it receives both according to ordinary send rules.

### Receipt states and manual mark-unread

The component distinguishes four concepts that chat UIs often collapse:

1. **Pending/local**: an optimistic client message that is not committed yet.
2. **Sent/committed**: the send mutation committed and returned a durable
   message ID and sequence.
3. **Delivered**: at least one authenticated client session for a recipient
   explicitly acknowledged receipt through a sequence.
4. **Read**: the recipient explicitly advanced their read watermark through a
   sequence.

Convex realtime subscription alone does not create a durable delivery receipt.
When delivery receipts are enabled, the client calls
`acknowledgeDeliveredThrough(sequence)` after receiving/rendering the reactive
result. Delivery watermarks are per membership, monotonic, and mean “at least
one device acknowledged,” not “every registered device received it.” A read
acknowledgment also advances delivery through the same sequence.

The component never marks a conversation read merely because messages were
queried. Host UI decides when content was genuinely presented—for example when
the conversation is focused and the last message crosses a visibility
threshold—and then calls `markReadThrough`. Headless helpers may implement this
policy, but it remains explicit and overridable.

Manual “mark unread” must not rewind `lastReadSequence`: doing so would retract
an already-observed read receipt and corrupt monotonic unread arithmetic.
Instead, membership stores a separate attention marker:

```text
manualUnreadFromSequence?: number
manualUnreadSetAt?: number
```

`markConversationUnread` sets that marker, defaulting to the latest visible
message. It makes the inbox show an unread dot/attention state even when the
true unread count is zero. It does not fabricate a numeric unread count or
change what other participants have already seen as read. Opening/marking
through that sequence clears the marker; `clearManualUnread` clears it
explicitly.

### Read-state configuration

Unread accounting is always maintained because inbox badges depend on it.
Receipt _exposure_ and delivery acknowledgments are configurable:

```ts
readState: {
  deliveryReceipts: "disabled" | "enabled";
  readReceiptVisibility: "none" | "directs" | "all";
  groupReadReceiptDetail: "aggregate" | "participants";
  manualUnread: boolean;
  newMemberHistory: "mark_existing_read" | "count_visible_history";
  countSystemMessages: "none" | "all" | { allow: string[] };
  countDataPartMessages: boolean;
  emitReceiptEvents: boolean;
}
```

- `readReceiptVisibility` controls what other participants may query; it never
  disables the subject's own unread bookkeeping.
- `groupReadReceiptDetail: "aggregate"` exposes counts such as “read by 4” but
  not subject identities. `participants` permits a paginated authorized list.
- Group receipt summaries describe currently eligible memberships whose history
  includes that sequence. They are not an immutable recipient manifest: removed
  or access-`none` subjects are excluded. Products needing compliance-grade
  proof of the recipient set at send time must persist a host audit record.
- `newMemberHistory` determines whether visible pre-join history starts read or
  contributes to unread state. It cannot grant history before
  `historyStartsAtSequence`.
- System/data-part message unread behavior is frozen into each message's optional
  `unreadOrdinal` at creation. Changing configuration affects future messages,
  not historical counts.
- Muting a conversation suppresses notifications, not unread accounting, and
  remains a host notification preference rather than a read-state mutation.
- Hosts may expose stricter per-user privacy settings by withholding receipt
  queries. The component must never return participant receipt details when the
  configured mode allows only aggregate or none.

### Presence and typing

Compose `@convex-dev/presence` as a child component.

- A chat conversation ID is the presence room ID.
- The `convex-chat` wrapper checks read access before issuing a heartbeat or
  room token.
- Presence `data` stores a versioned object such as
  `{ version: 1, typing: boolean }`.
- Maintained React and React Native hooks create per-device session IDs, send
  heartbeats, disconnect best-effort, debounce typing-on, and clear typing
  shortly after input stops.
- Typing is shown only for currently online subjects and is always best-effort.
- Typing state is never a message, audit record, notification trigger, or proof
  that a message was read.
- Host wrappers may suppress presence entirely for privacy-sensitive products.

Presence list limits and behavior must be documented as small-room behavior in
0.1. Large-room presence aggregation is out of scope.

### Realtime behavior

- Message lists, conversation summaries, unread counts, membership state, and
  presence are exposed through reactive host queries.
- Convex subscription updates are the realtime transport; the component does
  not implement a second WebSocket protocol.
- An optimistic message is keyed by `clientMessageId` and replaced by the
  committed message with the same ID.
- Reconnects query durable state. The component does not infer delivery from a
  subscription; optional durable delivery marks require the explicit
  acknowledgment API described above.
- A successful mutation means “committed to Convex,” not “seen by another
  device” and not “push delivered.”

### Post-commit events

The host-side `Chat` client accepts an optional internal Convex function
reference:

```ts
type ChatConfig = {
  onEvent?: FunctionReference<"mutation", "internal", ChatEventEnvelope>;
};
```

After a component mutation succeeds, the wrapper schedules the internal
mutation callback in the same parent mutation. Scheduling failure rolls the
parent transaction back; callback execution happens after commit and cannot
roll back the message. The first callback is deliberately a mutation rather
than an action: Convex guarantees scheduled mutations execute exactly once and
retries internal platform errors, while scheduled actions run at most once and
can permanently fail on transient external errors. The host callback should
persist its own delivery/outbox state before scheduling external actions.

Initial events:

- `message.created.v1`;
- `message.edited.v1`;
- `message.deleted.v1`;
- optional `reaction.changed.v1`;
- optional `receipt.advanced.v1`;
- `membership.changed.v1`; and
- `conversation.archived.v1`.

Every envelope contains stable `eventId`, `occurredAt`, `scopeId`,
`conversationId`, subject/context references needed for routing, and the
minimum event payload. Message part contents are excluded by default
from callback envelopes to reduce accidental disclosure. A host can query the
message after authorizing its downstream workflow.

The scheduled callback mutation is exactly once under Convex's scheduler
contract unless it fails with a developer error. External delivery remains a
separate host workflow and may be at least once; those consumers dedupe by
`eventId`. Push, email, webhooks, analytics, and moderation remain host
responsibilities.

## Proposed Data Model

Exact validator syntax may change during implementation, but semantic fields
and indexes should remain stable unless benchmarks invalidate them.

### `conversations`

```ts
{
  scopeId: string;
  kind: "direct" | "group";
  externalKey?: string;
  title?: string;
  state: "active" | "archived" | "deleting";
  createdBySubjectId: string;
  nextSequence: number;
  lastUnreadOrdinal: number;
  lastMessageId?: Id<"messages">;
  lastMessageSequence?: number;
  lastMessageAt?: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
}
```

Indexes:

- `scope_externalKey` on `[scopeId, externalKey]` for idempotent creation;
- `scope_state_updatedAt` on `[scopeId, state, updatedAt]`; and
- default ID lookup.

`externalKey` is unique within a scope by mutation invariant. The implementation
must use an indexed uniqueness check in the same mutation.

### `memberships`

```ts
{
  scopeId: string;
  conversationId: Id<"conversations">;
  subjectId: string;
  role: "owner" | "admin" | "member";
  state: "invited" | "active" | "left" | "removed";
  access: "read_write" | "read_only" | "none";
  historyStartsAtSequence: number;
  lastDeliveredSequence: number;
  lastDeliveredAt?: number;
  lastReadSequence: number;
  lastReadUnreadOrdinal: number;
  lastReadAt?: number;
  manualUnreadFromSequence?: number;
  manualUnreadSetAt?: number;
  inboxUpdatedAt: number;
  invitedBySubjectId?: string;
  joinedAt?: number;
  leftAt?: number;
  removedAt?: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
}
```

Indexes:

- `conversation_subject` on `[conversationId, subjectId]`, unique by invariant;
- `scope_subject_access_inboxUpdatedAt` on
  `[scopeId, subjectId, access, inboxUpdatedAt]` for activity-sorted inboxes;
- `conversation_state_role` on `[conversationId, state, role]`; and
- optional `subject_state_updatedAt` after query-plan validation.

`historyStartsAtSequence` lets an invite choose “all prior history” or “from
join.” The component enforces it on history queries. Access restoration must
explicitly state whether the boundary is preserved or advanced; it must never
silently broaden history.

### `messages`

```ts
{
  scopeId: string;
  conversationId: Id<"conversations">;
  sequence: number;
  unreadOrdinal?: number;
  authorSubjectId?: string; // absent for component system events
  clientMessageId?: string;
  parts: ChatMessagePart[];
  searchText?: string; // component-derived concatenation of text parts
  contextRef?: string;
  replyToMessageId?: Id<"messages">;
  quoteSnapshot?: {
    authorSubjectId?: string;
    fallbackText: string;
    sourceRevision: number;
  };
  status: "published" | "redacted";
  revision: number;
  editedBySubjectId?: string;
  editedAt?: number;
  redactedBySubjectId?: string;
  redactedAt?: number;
  createdAt: number;
}
```

Indexes:

- `conversation_sequence` on `[conversationId, sequence]`, unique by invariant;
- `conversation_author_clientMessageId` on
  `[conversationId, authorSubjectId, clientMessageId]` for idempotency;
- `replyToMessageId` on `[replyToMessageId]` for quote-snapshot cleanup after
  source deletion;
- `scope_author_createdAt` on `[scopeId, authorSubjectId, createdAt]` for subject
  lifecycle; and
- a future staged text search index filtered by conversation, not required in
  0.1.

Data and system parts must be versioned by type. Editing one text part
increments message `revision` without changing sequence, unread ordinal,
client message ID, other part IDs, or reply identity. Deletion/redaction clears
`parts` to an empty array and removes `searchText` rather than deleting the
row. Public queries immediately suppress quote snapshots whose source is
deleted; a bounded
resumable cleanup clears stored snapshots referencing that source so deleted
content is not retained indefinitely.

### `messageReactions`

```ts
{
  scopeId: string;
  conversationId: Id<"conversations">;
  messageId: Id<"messages">;
  subjectId: string;
  reactionKey: string;
  createdAt: number;
  updatedAt: number;
}
```

Indexes:

- `message_subject` on `[messageId, subjectId]`, unique by invariant;
- `message_reactionKey` on `[messageId, reactionKey]` for reactive counts and
  paginated reactors; and
- `scope_subject_updatedAt` on `[scopeId, subjectId, updatedAt]` for subject
  lifecycle.

The component validates that the message is published, the reacting subject
has `read_write` access, and the message belongs to the same conversation and
scope. Deleting a message hides its reactions immediately and clears them in a
bounded cleanup.

### Presence tables

Owned by the child `@convex-dev/presence` instance. `convex-chat` must not mirror
online state into durable conversation or membership documents.

## Proposed Public Server API

The package should expose a class-based host client, following established
Convex component practice:

```ts
const chat = new Chat(components.chat, {
  onEvent: internal.chatEvents.handle,
  limits: {
    maxTextCodePoints: 10_000,
    maxGroupMembers: 100,
    maxPartsPerMessage: 16,
    maxPartsBytes: 16 * 1024,
  },
  messaging: {
    allowedReactions: ["👍", "❤️", "😂", "😮", "😢", "🙏"],
    allowedDataParts: {
      "com.example.resource": [1],
    },
    editWindowMs: 15 * 60_000,
    authorDeleteWindowMs: 48 * 60 * 60_000,
    emitReactionEvents: false,
  },
  readState: {
    deliveryReceipts: "enabled",
    readReceiptVisibility: "directs",
    groupReadReceiptDetail: "aggregate",
    manualUnread: true,
    newMemberHistory: "mark_existing_read",
    countSystemMessages: { allow: ["member.joined", "member.removed"] },
    countDataPartMessages: true,
    emitReceiptEvents: false,
  },
});
```

The messaging and read-state settings above are illustrative host policy, not
proposed package defaults.

Names below describe the intended contract, not frozen TypeScript signatures.

### Actor-scoped reads

- `getConversation(ctx, { scopeId, subjectId, conversationId })`
- `listConversations(ctx, { scopeId, subjectId, paginationOpts })`
- `listMessages(ctx, { scopeId, subjectId, conversationId, paginationOpts })`
- `listMembers(ctx, { scopeId, subjectId, conversationId, paginationOpts })`
- `getUnreadCount(ctx, { scopeId, subjectId, conversationId })`
- `getUnreadCounts(ctx, { scopeId, subjectId, conversationIds })`
- `getMyReceiptState(ctx, { scopeId, subjectId, conversationId })`
- `getMessageReceiptSummary(ctx, { scopeId, subjectId, messageId })`
- `listMessageReceiptParticipants(ctx, ...)` only when configured exposure and
  actor authorization permit participant detail
- `listReactions(ctx, { scopeId, subjectId, messageId, paginationOpts })`
- `getReactionSummary(ctx, { scopeId, subjectId, messageId })`
- `listPresence(ctx, ...)`

### Actor-scoped writes

- `sendText(ctx, { ..., clientMessageId, text, contextRef?,
replyToMessageId? })`
- `sendData(ctx, { ..., clientMessageId, dataType, schemaVersion, data,
fallbackText, contextRef?, replyToMessageId? })`
- `sendParts(ctx, { ..., clientMessageId, parts, contextRef?,
replyToMessageId? })` for a bounded host-validated mix of text/data parts
- `markReadThrough(ctx, { ..., sequence })`
- `acknowledgeDeliveredThrough(ctx, { ..., sequence })`
- `markConversationUnread(ctx, { ..., fromSequence? })`
- `clearManualUnread(ctx, { ..., conversationId })`
- `markConversationsRead(ctx, { ..., items })` as a bounded batch operation
- `editOwnTextPart(ctx, { ..., messageId, partId, expectedRevision, text })`
- `deleteOwnMessage(ctx, { ..., messageId, expectedRevision })`
- `setReaction(ctx, { ..., messageId, reactionKey? })`, where omission removes
  the subject's current reaction
- `inviteMember(ctx, { ..., invitedSubjectId, historyPolicy })`
- `acceptInvitation(ctx, ...)`
- `declineInvitation(ctx, ...)`
- `removeMember(ctx, ...)`
- `leaveConversation(ctx, ...)`
- `setMemberRole(ctx, ...)`
- `transferOwnership(ctx, ...)`
- `heartbeat(ctx, ...)`
- `setTyping(ctx, ...)`
- `disconnectPresence(ctx, ...)`

### Privileged host operations

These are intentionally named differently from actor operations:

- `systemCreateDirectConversation`
- `systemCreateGroupConversation`
- `systemGetOrCreateByExternalKey`
- `systemSetMemberAccess` with expected membership revision and explicit
  history policy
- `systemDeleteMessage`
- `systemArchiveConversation`
- `systemStartConversationDeletion`
- `systemStartSubjectAnonymization`

The package documentation must warn that exposing `system*` methods through a
public host function without authorization bypasses actor role checks.

### Headless client helpers

Initial maintained exports:

- React and React Native presence/typing hooks;
- optimistic-send helper keyed by `clientMessageId`;
- optimistic edit/delete/reaction helpers keyed by message ID and revision;
- unread optimistic watermark helper;
- message-page normalization helper;
- `ChatUIMessage` projection utilities, runtime validators, and safe
  unknown-part fallbacks;
- framework-neutral renderer-registry types, with React/React Native adapter
  helpers; and
- shared public types and validators.

An AI SDK conversion entry point is explicitly deferred beyond 0.1. The 0.1
types and fixtures should avoid choices that make a future adapter lossy, but
the human-chat release does not depend on `ai` or promise support for its full
AI-specific part union.

Vue/Svelte hooks and a styled component library are deferred. Framework-neutral
server APIs remain usable everywhere.

## Authorization Invariants

- Every actor read requires membership with access other than `none`.
- Every actor send requires `active + read_write`.
- `read_only` can read only at or after `historyStartsAtSequence` and cannot
  mutate messages or membership.
- `none` cannot discover the conversation through ID, inbox, unread, member,
  message, presence, or search queries.
- Conversation existence and membership counts must not leak through different
  error text to unauthorized actors.
- A direct conversation has exactly two distinct-subject memberships and actor
  operations cannot change that set.
- A group always has exactly one owner.
- Only owner/admin may invite or remove ordinary members.
- Only owner may promote/demote admins in 0.1.
- No actor may remove/demote the owner; ownership transfer is explicit.
- Delivery and read watermarks are monotonic, conversation-local, and cannot
  exceed a sequence visible to that membership.
- `markReadThrough` is monotonic and cannot exceed a visible committed sequence.
- Advancing read also advances delivered through the same sequence.
- Manual mark-unread never rewinds delivery/read watermarks, never retracts a
  receipt already exposed to another member, and never fabricates a numeric
  unread count.
- Receipt-detail queries obey configured visibility and group-detail mode even
  when the caller can otherwise read the conversation.
- Querying/subscribing to messages alone never marks them delivered or read.
- A message author must equal the authenticated host-derived subject passed to
  the actor-scoped call.
- Subject-authored messages may contain only configured text/data parts;
  component system messages have no `authorSubjectId` and may contain only
  component-generated system parts. A bot or service with a subject identity
  never impersonates the component system sender.
- Denormalized membership/message `scopeId` must equal the owning
  conversation's scope and is never caller-patchable.
- Aggregate part size, part count, namespaced data-type allowlist, and common
  part envelopes are checked before insert. Host wrappers validate application
  payload schemas before calling the component.
- Only the author can edit a text part in a published message, and every edit
  requires the current expected message revision.
- Group owners/admins may delete according to policy but can never edit another
  subject's content.
- Editing or deleting never changes message sequence, unread ordinal,
  `clientMessageId`, author, or reply target.
- A reply target must be published, visible to the sender, and belong to the
  same conversation and scope; reply chains do not create nested subthreads.
- Quote snapshots are generated by the component, bounded, and never accepted
  as trusted client input.
- A subject has at most one active reaction per message; reactions require
  `read_write` access and a published visible message.
- Reactions never alter message order or unread counts.
- Redaction never reorders history or reuses a sequence, and deleted source
  content is suppressed from reply snapshots and reaction results immediately.
- Restoring access never silently moves `historyStartsAtSequence` earlier.
- Archiving blocks new writes but preserves authorized reads until host policy
  revokes them.

## Errors

Export stable error codes using `ConvexError`, while keeping unauthorized/not
found responses deliberately indistinguishable where appropriate:

- `CHAT_NOT_FOUND_OR_FORBIDDEN`
- `CHAT_READ_ONLY`
- `CHAT_ARCHIVED`
- `MESSAGE_TOO_LARGE`
- `MESSAGE_NOT_EDITABLE`
- `MESSAGE_NOT_DELETABLE`
- `STALE_MESSAGE_REVISION`
- `INVALID_REPLY_TARGET`
- `REACTION_NOT_ALLOWED`
- `RECEIPTS_NOT_EXPOSED`
- `INVALID_RECEIPT_SEQUENCE`
- `MANUAL_UNREAD_DISABLED`
- `CUSTOM_TYPE_NOT_ALLOWED`
- `IDEMPOTENCY_CONFLICT`
- `STALE_MEMBERSHIP_REVISION`
- `INVALID_MEMBERSHIP_TRANSITION`
- `OWNER_TRANSFER_REQUIRED`
- `PAGINATION_BOUNDARY_INVALID`
- `RATE_LIMITED` only if an optional rate-limiter integration is later added

Error messages must not include message-part content, private titles,
or raw membership data.

## Storage and Attachment Roadmap

Files and audio are not part of 0.1, but storage must not be painted into a
corner.

### Decision

Keep attachment bytes outside the core message transaction. A future message
part references an attachment record owned by `convex-chat`; that record stores
metadata and an opaque storage key. Upload/serve/delete behavior is provided by
an adapter.

Candidate adapters:

1. Native Convex file storage.
2. `@convex-dev/r2` for expiring signed URLs and potentially lower-cost object
   storage/egress.
3. Host-managed S3-compatible or custom storage through explicit wrapper APIs.

Do not make R2 a mandatory child dependency. A component cannot assume access
to an independently installed sibling component, and forcing one backend would
make package adoption and credentials unnecessarily rigid.

### Future attachment lifecycle

Planned, not 0.1:

1. Host authorizes upload for a specific conversation and subject.
2. Adapter issues a short-lived upload target.
3. Client uploads bytes directly.
4. Host/adapter verifies size, hash, MIME allowlist, and scanning state.
5. Component registers an attachment as `pending | ready | rejected`.
6. A send mutation atomically references only `ready` attachments.
7. Download resolution rechecks current conversation access.
8. Redaction/deletion decrements reference counts and schedules cleanup.

Native Convex `storage.getUrl()` produces bearer URLs. For conversations whose
access may later be revoked, an authorization-checking HTTP route or expiring
R2 signed URL is safer than long-lived direct URLs. Audio additionally needs
duration, codec/container allowlists, waveform/metadata generation, playback
range behavior, transcription consent, and mobile background-upload policy.

## Privacy, Security, and Abuse Boundaries

- No end-to-end encryption claim. Convex deployment operators and authorized
  backend code can access plaintext message content.
- Host identity references should be opaque and avoid emails or phone numbers.
- Never log text/data part content, titles, or future attachment URLs.
- Component methods must validate sizes before database writes.
- Host must rate-limit sends and typing mutations. Typing hooks debounce changes
  and presence heartbeats use the child component's efficient expiry worker.
- Data parts are untrusted when rendered. The component stores bounded Convex
  values; clients must validate the declared schema version, map allowlisted
  types to safe renderers, and never execute stored code or HTML. Interactive
  actions must re-authorize against current host state.
- Host owns user blocks and safety policy. A blocked relationship must be
  projected to component access before further sends are allowed.
- Redaction is not guaranteed erasure from backups or already delivered push,
  email, exports, screenshots, or external event consumers.
- Presence and read receipts are privacy-sensitive. Hosts decide whether to
  expose them and document that policy.
- Account deletion in shared conversations is a product/legal decision. The
  component provides anonymization/redaction primitives but does not choose
  between preservation of shared history and erasure.

## Deletion, Retention, and Export

Version 0.1 must not ship with only unbounded inserts.

- `systemStartConversationDeletion` marks a conversation `deleting`, revokes
  writes, and deletes messages/memberships in bounded resumable batches before
  deleting the conversation.
- `systemStartSubjectAnonymization` removes the subject's membership/profile
  reference and replaces author identifiers with a stable component-generated
  tombstone identifier where shared-message preservation is selected.
- Optional authored-message redaction is an explicit mode, not an accidental
  side effect.
- Operations are idempotent and expose progress/status.
- A generic export query pages a subject's memberships and authored messages;
  the host formats and delivers the export.
- Automatic time-based retention is deferred until its effect on group history,
  unread watermarks, deep links, and host legal requirements is designed.

The implementation may split lifecycle work into a 0.1.x release only if the
initial 0.1 is clearly marked pre-production. Production-ready 0.1 requires
bounded conversation deletion at minimum.

## Example Host-Application Mapping

The component remains independent of any one product. A relationship-based
application can map common requirements this way:

| Application requirement                                   | `convex-chat` mapping                                               | Remains in the host application                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| One thread per participant pair, reused after reconnect   | Stable `externalKey` for the pair                                   | Pair key construction and relationship lifecycle                               |
| Every message stamped with authorizing relationship       | `contextRef` on each message                                        | Validating that relationship is currently canonical                            |
| Active pair can send                                      | Both memberships `read_write`                                       | Relationship activation transaction                                            |
| Ended participant cannot see thread                       | Participant access `none`                                           | Product navigation and safe fallback                                           |
| Former service provider may read only the old shared chat | Provider access `read_only`                                         | Policy deciding whether exception applies                                      |
| Disabled identity has no access                           | Membership access `none`                                            | Identity status                                                                |
| Realtime messages                                         | Reactive paginated message query                                    | Application UI                                                                 |
| Unread badge and manual mark-unread                       | Membership unread watermark plus separate attention marker          | Chat tab/dashboard badge presentation and whether manual unread is exposed     |
| Delivered/read marks                                      | Optional monotonic membership receipts with configurable visibility | Deciding which participants see receipt state                                  |
| Message push                                              | `message.created.v1` event                                          | Notification preferences, copy, push, deep link, and relationship recheck      |
| Rich cards and shared app objects                         | Ordered, versioned data parts with fallback text                    | Native schemas and renderers; actions remain host-authorized                   |
| Edit/delete/reply/reaction mechanics                      | Revisioned edits, tombstones, reply snapshots, and reaction records | Interaction UI, product-specific windows, reaction allowlist, and audit policy |
| Attachments                                               | Adapter-backed attachment contract                                  | Upload authorization, object storage, and media policy                         |
| Private AI chat hidden from human participants            | Separate agent threads; never added to human conversation           | AI consent and agent product                                                   |

A host may adopt only the subset it needs. Its roadmap cannot block or define
the open-source component's independent release.

## Architecture Sketch

```text
React / React Native / other client
          |
          v
host public Convex functions
  - authenticate caller
  - derive scopeId + subjectId
  - enforce domain policy / limits
          |
          v
Chat host-side client
          |
          +----> convex-chat component
          |        - conversations
          |        - memberships / roles / access
          |        - messages / ordering / unread
          |        - deletion lifecycle
          |
          +----> child @convex-dev/presence
          |
          +----> optional scheduled host onEvent
                   - push / email / moderation / analytics

future upload path:
client -> host-authorized adapter -> Convex storage / R2 / custom store
                                      |
                                      v
                            attachment reference in chat
```

## V0.1 Implementation Plan

### Phase 0: Repository and contract scaffolding

1. Create the independent repository from the current Convex component
   template rather than copying generated/build output from another package.
2. Add Apache-2.0 license, `AGENTS.md`, `CONTRIBUTING.md`, security policy,
   Code of Conduct, README, changelog, and semantic-version release script.
3. Use the package layout proven by `convex-wearables`:
   `src/component`, `src/client`, `src/react`, `src/react-native`, tests,
   generated component entry point, and example app.
4. Confirm the npm scope and GitHub repository name before publishing.
5. Pin supported minimum Convex, TypeScript, Node, React, and React Native
   versions based on the template current at implementation time.

Exit criteria:

- component codegen, typecheck, lint, tests, build, and package dry-run execute
  in CI;
- example app installs the packed artifact, not source aliases; and
- public entry points match Convex component publishing guidance.

### Phase 1: Schema, core types, and error model

1. Implement validators/types for scopes, conversation kinds/states,
   membership roles/states/access, stored message parts/status, renderable
   message projections, events, and pages.
2. Implement the proposed schema and indexes.
3. Add size-measurement utilities using Convex serialization size helpers.
4. Add stable `ConvexError` codes and non-leaking authorization errors.
5. Add property/invariant test helpers for one owner, unique membership,
   unique sequence, and monotonic watermarks.

Exit criteria:

- every public component function has argument and return validators;
- schema/index tests cover every intended query path; and
- no component API accepts host table IDs as Convex IDs across the boundary;
  external identifiers are strings.

### Phase 2: Conversations and memberships

1. Implement system create/get-or-create APIs with external-key idempotency.
2. Implement direct conversation provisioning.
3. Implement group invite, accept/decline, remove, leave, role changes, and
   ownership transfer.
4. Implement expected-revision access projection APIs.
5. Implement visible conversation/member list queries with pagination.
6. Add optional system messages for membership events behind configuration.

Exit criteria:

- direct/group invariants survive concurrent duplicate creation and membership
  mutations;
- unauthorized subjects cannot distinguish nonexistent from forbidden IDs; and
- access `none` removes all discovery/read/presence paths.

### Phase 3: Messages, editing/deletion, replies, reactions, and realtime pagination

1. Implement ordered text/data/system part insertion with stable part IDs,
   envelope validation, fallback text, and atomic sequence allocation.
2. Implement `clientMessageId` dedupe and payload-conflict detection.
3. Update conversation last-message projection in the same mutation.
4. Implement component-safe cursor pagination with `convex-helpers`.
5. Implement author-only text-part edits with expected revisions and edit
   events.
6. Implement author/admin/system delete-for-everyone tombstones.
7. Implement same-conversation reply validation and server-generated bounded
   quote snapshots.
8. Implement one-per-subject reaction toggle/replace, reactive summaries, and
   paginated reactors.
9. Implement bounded cleanup for reactions and quote snapshots referencing a
   deleted source message.
10. Implement optimistic send/edit/delete/reaction reconciliation helpers.
11. Schedule stable host `onEvent` callbacks.

Exit criteria:

- retries return one committed message and one stable event ID;
- concurrent sends produce unique strictly increasing sequences;
- pagination has no duplicates/gaps under head inserts in documented usage;
- stale edits cannot overwrite a newer revision;
- only authors edit, while configured admins may delete without impersonating
  the author;
- replies cannot cross conversations or preserve publicly visible text after
  the source is deleted;
- reaction replacement is atomic and never changes unread counts;
- deletion removes content and reactions from every public return path; and
- callback failure after commit cannot remove or duplicate a message.

### Phase 4: Read state and conversation inbox

1. Allocate unread ordinals and maintain membership watermarks.
2. Implement monotonic delivered/read acknowledgments, with read implying
   delivered.
3. Implement O(1) unread counts and bounded batch counts.
4. Implement manual mark-unread as a separate attention marker.
5. Build conversation summaries with last-message preview, true unread count,
   and manual-unread state.
6. Add configured receipt summaries and aggregate/paginated group detail.
7. Apply new-member and system/data-part unread policies at write/join time.
8. Implement optimistic mark-read/manual-unread helpers and optional
   visibility-based acknowledgment hooks.

Exit criteria:

- randomized concurrency tests never move a watermark backward;
- read always implies delivered and message queries alone advance neither;
- manual unread never retracts read receipts or invents unread counts;
- disabled/aggregate receipt modes cannot leak participant detail;
- own sends do not leave the sender with artificial unread messages;
- history boundaries and access restoration cannot broaden history; and
- edits, deletions, reactions, replies, and system messages follow their
  documented unread behavior.

### Phase 5: Presence and typing

1. Install `@convex-dev/presence` as a child component.
2. Wrap heartbeat/list/update/disconnect with chat access checks.
3. Implement versioned typing presence data.
4. Add React and React Native hooks with stable session IDs, debounce, timeout,
   disconnect, and visibility/background handling.
5. Add fake-timer and multi-session tests.

Exit criteria:

- unauthorized/removed subjects cannot enter or list the room;
- typing expires after disconnect or missed heartbeats;
- one subject with multiple devices remains online while any valid session is
  alive; and
- heartbeats do not invalidate message/history queries.

### Phase 6: Lifecycle, documentation, examples, and release hardening

1. Implement bounded resumable conversation deletion.
2. Implement explicit subject anonymization modes and export pagination.
3. Build a minimal React example with DM, group, unread, presence, typing,
   editing, deletion, reactions, reply/quote flows, and one registered rich
   data-part card with a safe fallback.
4. Add a React Native example or automated compatibility fixture.
5. Write README quick start, API reference, security model, integration guide,
   lifecycle guide, rich-part/renderer guide, future-interoperability note, and
   `UPGRADING.md`.
6. Document a generic host-application mapping as an example, not a package dependency.
7. Run load/contention experiments and publish results and limits.
8. Run package dry-run and test installation from the tarball.
9. Document a non-binding mapping from the generic 0.1 parts to AI SDK
   `UIMessagePart` and the dependency boundary for a future adapter; do not add
   `ai` to 0.1 dependencies or public type declarations.

Exit criteria:

- all acceptance criteria below pass;
- lifecycle work is resumable under transaction limits;
- docs clearly distinguish commit, realtime visibility, read state, and
  external delivery; and
- 0.1.0 is usable without host-application code or schemas.

## Test Plan

### Unit and component tests

- create/get-or-create idempotency and external-key payload conflicts;
- direct conversation exactly-two-members invariant;
- group owner/admin/member permission matrix;
- concurrent invites, acceptance, removals, promotions, and ownership transfer;
- access changes with expected revisions;
- send authorization for every membership/access state;
- concurrent sequence allocation and idempotent send retries;
- text/data/system part count, size, ID, type, schema-version, and fallback
  validation;
- ordered multi-part projection, unknown-type fallback, and safe renderer
  dispatch;
- generic part projection fixtures that do not require an AI SDK dependency;
- pagination ordering under new head messages;
- edit authorship, expected-revision conflicts, and immutable ordering fields;
- delete authorization, tombstone behavior, and bounded referenced-quote cleanup;
- same-conversation reply validation and unforgeable quote snapshots;
- reaction toggle/replace concurrency, summaries, and cleanup;
- watermark monotonicity and unread arithmetic;
- delivery/read implication and monotonic receipt advancement;
- manual-unread separation from true count and exposed receipts;
- receipt visibility modes, group aggregation, and participant-detail denial;
- new-member and system/data-part unread policies;
- history boundary enforcement;
- event envelope stability and dedupe IDs;
- presence multi-session expiry and typing clear;
- archive, deletion resume, and subject anonymization; and
- forbidden/no-access non-disclosure.

Use `convex-test`, Vitest, fake timers, and property-based/randomized state
machine tests where concurrency/state transitions are the risk.

### Integration tests

- Pack and install the npm tarball into the example application.
- Exercise host-auth wrappers rather than invoking only component internals.
- Run two browser sessions and a React Native compatibility fixture.
- Simulate offline optimistic send followed by retry/reconnect.
- Simulate concurrent edits at the same revision and verify one wins.
- Simulate reply, source edit, then source deletion and verify snapshot
  preservation followed by immediate suppression/cleanup.
- Simulate concurrent reaction toggle/replace from multiple sessions.
- Simulate query, delivery acknowledgment, read acknowledgment, manual unread,
  and reopening across two devices.
- Verify receipt-disabled and aggregate-only modes do not leak participant
  identities.
- Simulate event callback retry and verify one message.
- Simulate host relationship transition and chat access projection in one
  mutation.
- Render the same data part through React and React Native registries and verify
  that an unknown/newer schema version degrades to fallback text.
- Exercise a rich-part action and verify that the host re-authorizes current
  domain state and deduplicates repeated interaction attempts.

### Performance investigation

Benchmark at minimum:

- concurrent sends into one DM and one group;
- inbox write fan-out and activity sorting as group membership approaches the
  configured cap;
- inbox query for subjects with increasing conversation counts;
- message pagination across long histories;
- edit/delete fan-out to reply snapshots and reactions;
- reaction summaries and reactor pagination;
- batch unread counts;
- receipt-summary aggregation and bounded participant pagination;
- delivered/read acknowledgment write contention;
- membership listing and admin operations; and
- presence heartbeat/typing load without message-query invalidation.

Do not publish a maximum group size or messages-per-second claim until measured
against current Convex tiers. Record Convex version, tier, dataset size,
concurrency, p50/p95/p99 latency, retries/conflicts, function calls, and database
I/O.

## Release and Versioning

- `0.1.0`: initial unstable public contract. Breaking changes may use minor
  versions while pre-1.0 but require explicit upgrade notes.
- Patch: backward-compatible bug/documentation fixes.
- Minor: additive APIs/schema or documented pre-1.0 breaking changes with
  migration guidance.
- `1.0.0`: only after production usage validates schema evolution, lifecycle,
  scale, and authorization boundaries.

Schema changes must prefer additive optional fields and staged indexes. Any
change to message ordering, membership visibility, unread arithmetic,
idempotency keys, or authorization semantics is behaviorally breaking even if
TypeScript still compiles.

## Acceptance Criteria for 0.1.0

- An app can install the package as a Convex component and construct a typed
  `Chat` client.
- The package works without host-application tables, Clerk, Auth0, or any specific auth
  provider.
- A host can idempotently create a two-member direct chat and a small group.
- Group owner/admin/member transitions satisfy the fixed role matrix and never
  leave a group without one owner.
- Only active `read_write` members can send.
- `read_only` members can read permitted history but cannot mutate it.
- `none` members cannot discover or read the conversation through any API.
- Concurrent sends have unique stable order.
- Retrying the same client send produces one durable message.
- Text and allowlisted data parts update subscribed clients reactively and
  preserve their stable part IDs and order.
- Unknown data-part types or schema versions return a safe fallback rather than
  executing code or breaking the timeline.
- No application-domain type, schema, renderer, command, or brand appears in
  the component's public contract or runtime implementation.
- Message parts contain only renderable content; revisions, relations,
  reactions, permissions, receipts, and unread state remain separate envelope
  or chat-state concepts.
- The UI projection keeps sender identity and message metadata separate from
  ordered parts without introducing AI-specific roles or dependencies.
- Paginated history remains stable while new messages arrive.
- Authors can edit their own text with revision protection; other members and
  admins cannot edit it.
- Authors and authorized admins can delete for everyone without removing the
  message's sequence or reply identity.
- A message can reply to one visible message in the same conversation and gets
  a bounded server-generated quote snapshot.
- Deleting a source message immediately hides its quoted content and reactions
  from every public query, with bounded cleanup of stored references.
- Each member can atomically add, change, or remove one allowlisted reaction per
  published message, and reaction changes appear reactively.
- Per-conversation unread counts are exact under the documented model and read
  watermarks never move backward.
- Optional delivered/read marks advance explicitly and monotonically; read
  implies delivered, while querying messages implies neither.
- Receipt visibility can be disabled, limited to direct conversations, or
  enabled for all conversations, with aggregate-only group mode.
- Manual mark-unread produces an attention state without rewinding read
  receipts or fabricating a numeric count.
- New-member history and system/data-part unread behavior follow configured policy
  without broadening history access.
- Online and typing state works for React and React Native and expires safely.
- Delete-for-everyone redaction removes content while preserving a tombstone
  and sequence.
- Post-commit message events have stable IDs and do not contain content by
  default.
- Conversation deletion is bounded, resumable, and idempotent.
- Public APIs have runtime validators and stable documented errors.
- CI passes lint, typecheck, unit/integration tests, build, and package dry-run.
- README and example show the secure host-wrapper pattern.
- Published scale claims, if any, are backed by reproducible benchmark results.

## Risks and Tradeoffs

### Hot conversation counter

One counter gives exact order and cheap unread state but can cause contention in
a very busy room. Accept for 0.1, benchmark it, and avoid large-room marketing.
Potential future designs include range allocation, time-sortable IDs plus a
separate read model, or conversation shards, each with different consistency
tradeoffs.

### Component-to-host authorization gap

The component cannot authenticate against a host users table. A badly written
host wrapper can pass a forged subject. Documentation, ready-made wrapper
factories, tests, and conspicuous `system*` names reduce this risk but cannot
eliminate host bugs.

### Rich-part portability and SDK drift

Data parts are valuable for application chat but can become an unversioned
dumping ground. Require namespaced allowlisted types, stable part IDs, bounded
payloads, fallback text, host validation, schema versions, and versioned
renderers. The component never interprets business meaning or executes stored
code. Keep the durable `ChatUIMessage` contract independent from AI SDK,
TanStack AI, AG-UI, A2UI, and MCP Apps release cycles; compatibility belongs in
versioned adapters with fixtures against pinned upstream versions.

### Presence dependency

Composing the official Presence component avoids reimplementing efficient
expiry, but couples compatible version ranges and adds a child component. Pin a
tested range and expose chat-owned abstractions so the dependency can evolve
without breaking consumers.

### Receipt privacy and multi-device meaning

Read receipts reveal behavior and can create social pressure, while a delivery
tick can be misread as proof that every device received a message. The API and
docs must use precise semantics: delivered means at least one authenticated
session acknowledged; read means the membership watermark advanced. Exposure
is configurable and unread accounting continues privately when receipts are
hidden.

### Shared-history deletion

Deleting one subject from a group conflicts with preserving other members'
conversation history. The component must expose explicit anonymize/redact
modes; it cannot claim one universal legal answer.

### Edit history and quote snapshots

Keeping every prior body provides stronger audit history but conflicts with
data minimization and deletion expectations. Version 0.1 keeps edit metadata,
not old bodies. Quote snapshots preserve conversational context but temporarily
duplicate source text; source deletion therefore requires immediate public
suppression and resumable physical snapshot cleanup.

### Files and revoked access

Bearer file URLs can outlive membership. Future attachment adapters must
resolve access at download time or issue expiring URLs, and deletion must handle
references and external-store failure durably.

## Open Questions Before Coding

1. Confirm a neutral package scope and repository organization intended for
   stewardship beyond the first consuming application. Public package names,
   types, examples, and configuration must not use that application's brand.
2. Should multi-part `sendParts` ship in 0.1.0, or should 0.1.0 expose only the
   one-part `sendText`/`sendData` conveniences over the same durable parts
   schema? General application-chat use cases favor proving the multi-part
   contract early.
3. What default edit and author-delete windows should examples recommend? The
   component supports configured windows, but should not silently impose one
   product's social policy on every host.
4. Should read positions be component-queryable only through a separate method,
   or also included in member records returned to admins?
5. For reactivated membership, should the default preserve the original history
   boundary or advance to reactivation time? The proposal requires callers to
   choose explicitly.
6. Should system membership messages count as unread by default? Proposal:
   configurable per event type, with member joins/removals counting and quiet
   role/access maintenance not counting.
7. Does the first release need both React and React Native examples, or one
   example plus automated compatibility fixtures?
8. Is the child Presence component's current room limit sufficient for the
   declared small-group target, and what exact version range should be pinned?
9. What benchmark result should block 0.1.0 versus merely constrain documented
   scale?
10. What minimum lifecycle API is required before calling 0.1 production-ready:
    conversation deletion only, or subject anonymization/export as well?
11. Should the package example default to direct-only read receipts or no
    exposed receipts? The proposal favors direct-only as a useful demonstration
    while requiring hosts to make an explicit privacy decision.
12. Should manual-unread remain a boolean attention marker only, or should a
    future version expose a separately labeled “messages since reminder” count?
13. After the human-chat 0.1 contract is stable, should a future AI SDK adapter
    be a separate package or optional entry point? The current proposal favors
    a separately versioned adapter with `ai` as a peer dependency so upstream
    churn cannot force core chat upgrades.
14. Should 0.1 data-part registration accept only explicit type/version
    allowlists in the component client, or also provide a Standard Schema-based
    host wrapper that unifies server validation, client validation, and inferred
    TypeScript types?
15. What is the first concrete threshold for promoting a native data part into
    a surface: a client-owned A2UI catalog, a sandboxed MCP App, or an ordinary
    deep link to the host application? The proposal defaults to native data
    parts and requires an explicit security review before embedded surfaces.

## Sources

### Convex primary documentation

- [Understanding Components](https://docs.convex.dev/components/understanding):
  component isolation, state, nested transactions, and validation.
- [Authoring Components](https://docs.convex.dev/components/authoring): package
  anatomy, component IDs crossing as strings, host wrappers, class clients,
  pagination constraints, codegen, publishing entry points, and function
  handles.
- [Using Components](https://docs.convex.dev/components/using): reactive
  component queries and installed client patterns.
- [Convex Components Directory](https://www.convex.dev/components): directory
  audit and publication requirements.
- [Paginated Queries](https://docs.convex.dev/database/pagination): cursor-based
  reactive pagination behavior.
- [Indexes](https://docs.convex.dev/database/reading-data/indexes/): ordered
  indexed reads and `_creationTime` tie-breaking.
- [Full Text Search](https://docs.convex.dev/search/text-search): reactive
  paginated text search, filter fields, and current limits.
- [File Storage](https://docs.convex.dev/file-storage/overview): storage
  capabilities and bearer-URL security model.
- [Uploading Files](https://docs.convex.dev/file-storage/upload-files):
  short-lived upload URLs and authorization point.
- [Convex Limits](https://docs.convex.dev/production/state/limits): document,
  transaction, function, storage, and concurrency limits.
- [Scheduled Functions](https://docs.convex.dev/scheduling/scheduled-functions):
  atomic scheduling from mutations and the different exactly-once mutation
  versus at-most-once action execution guarantees.

### Convex component/source references

- [`get-convex/agent`](https://github.com/get-convex/agent): thread/message
  schema, ordered messages, component-safe pagination, files/ref-counting,
  optimistic helpers, and deletion patterns.
- [Agent threads documentation](https://docs.convex.dev/agents/threads): thread
  lifecycle and pagination.
- [Agent messages documentation](https://docs.convex.dev/agents/messages):
  message storage/order, manual human messages, optimistic updates, and delete
  behavior.
- [Agent human-agents guide](https://docs.convex.dev/agents/human-agents): using
  Agent storage for human responses and why it is adjacent rather than a full
  human-chat domain.
- [`@convex-dev/presence`](https://github.com/get-convex/presence): efficient
  heartbeat/session expiry, arbitrary room data, and React/React Native hooks.
- [Presence component directory entry](https://www.convex.dev/components/presence):
  published version and usage overview at investigation time.
- [`convex-unread-tracking`](https://github.com/TimpiaAI/convex-unread-tracking):
  community watermark/read-receipt design and subscription features.
- [Unread Tracking directory entry](https://www.convex.dev/components/convex-unread-tracking):
  published API overview at investigation time.
- [`@vllnt/convex-reactions`](https://github.com/vllnt/convex-reactions):
  community toggle-edge model, reactive counts, and paginated reactor design.
- [`@convex-dev/r2`](https://github.com/get-convex/r2): signed upload/download
  URLs, metadata, deletion, multiple buckets, and host authorization hooks.

### Rich-message, agent-UI, and app-surface references

- [AI SDK `UIMessage`](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message):
  UI-facing message state, generic metadata, typed data parts, and typed tool
  parts.
- [AI SDK `validateUIMessages`](https://ai-sdk.dev/docs/reference/ai-sdk-core/validate-ui-messages):
  runtime validation for metadata, registered data parts, and tools; evidence
  that TypeScript part types alone are not a runtime trust boundary.
- [AI SDK streaming custom data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data):
  persistent versus transient data parts, stable-ID reconciliation, metadata,
  and application rendering.
- [AI SDK generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces):
  rendering typed tool parts according to lifecycle state.
- [TanStack AI `MessagePart`](https://tanstack.com/ai/latest/docs/reference/type-aliases/MessagePart):
  independent convergence on a discriminated union spanning text, media,
  thinking, tools, structured output, and UI resources.
- [TanStack AI tool architecture](https://tanstack.com/ai/latest/docs/tools/tool-architecture):
  separate call/result parts, streaming input, approval, completion, and error
  states.
- [AG-UI overview](https://docs.ag-ui.com/introduction): vendor-neutral live
  agent/frontend events for messages, tools, shared state, interrupts, and
  custom events; distinct from durable human-chat storage.
- [AG-UI events](https://docs.ag-ui.com/sdk/js/core/events): start/delta/end
  event vocabulary for text and tool calls plus state snapshots.
- [A2UI v0.9 specification](https://a2ui.org/specification/v0.9-a2ui/):
  declarative streaming UI surfaces, separate structure/data, and client-owned
  component catalogs.
- [MCP Apps overview](https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html):
  sandboxed interactive HTML resources, tool-to-UI linkage, capability
  negotiation, bidirectional communication, and text fallback.
- [Matrix Client-Server API message relations](https://spec.matrix.org/latest/client-server-api/):
  mature durable-chat precedent for extensible event content, replies,
  replacements, relations/aggregations, and fallback representations.

### Messaging-system references

- [Telegram groups and channels](https://core.telegram.org/api/channel): roles,
  membership, ownership transfer, invite links, admin logs, and per-chat message
  sequences.
- [Telegram admin rights](https://core.telegram.org/api/rights): evidence for a
  future granular permission model, deliberately simplified in 0.1.
- [Telegram read state](https://core.telegram.org/api/views): monotonically
  increasing maximum-read positions.
- [Telegram updates](https://core.telegram.org/api/updates): new/edit/delete
  updates and channel-specific message IDs.
- [Signal technical documentation](https://signal.org/docs/): evidence that
  end-to-end encrypted messaging is a separate cryptographic/device-session
  system and must not be implied by a server-side chat component.

## Investigation Summary

The component is justified, but its value is not “Convex realtime chat” alone.
Its value is a coherent, tested set of membership, ordering, idempotency,
unread, presence, lifecycle, and integration invariants that applications would
otherwise implement inconsistently.

The recommended first implementation remains intentionally smaller than a
WhatsApp or Telegram backend. Text/data-part DMs and small groups are enough to
validate the abstraction across real applications. Files and audio should
follow through a storage-adapter design after message lifecycle, access
revocation, and deletion behavior are proven.
