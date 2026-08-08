---
title: Expo and React Native example PRD
description: Product requirements and implementation direction for a native mobile chat example sharing the web example's Convex backend.
date: 2026-08-08
last_updated: 2026-08-08
status: IMPLEMENTED
owner_repo: convex-chat
---

# Expo and React Native Example App PRD

## Executive decision

Add a complete native mobile example at `apps/example-native`, built with Expo,
React Native, and Expo Router. Keep the existing Next.js example at
`apps/example` as the browser client.

Extract the demo-specific Convex host functions, schema, R2 integration, and
generated API from `apps/example/convex` into a private workspace package named
`packages/example-backend`. Both example clients must import the same generated
API and connect to the same Convex deployment.

Use HeroUI Native for general-purpose mobile UI such as buttons, avatars,
badges, skeletons, alerts, menus, and sheets. Compose chat-specific UI with
React Native primitives where that gives better list, keyboard, gesture, or
accessibility behavior. Do not attempt to share rendered UI components between
the Next.js and React Native apps.

The baseline development experience must work in Expo Go without generating
`ios/` or `android/` projects or creating a custom development build. A custom
development build is a future escape hatch, not a requirement for this example.

This gives the repository one backend and two genuinely different clients:

```text
apps/example (Next.js) -------\
                               \
                                > packages/example-backend
                               /        |
apps/example-native (Expo) ---/         v
                                   one Convex dev deployment
                                   + one R2 bucket
```

Each process creates its own `ConvexReactClient` and `ConvexProvider`. “Shared
provider” means shared deployment configuration and generated API, not a React
provider instance shared across processes or devices.

## Why this direction

The current reusable component boundary is already correct:
`packages/convex-chat` owns chat invariants, while the example host owns demo
identity, host wrappers, and attachment policy. The obstacle is that this host
code currently lives inside the web app, making the web app the accidental
owner of a backend that the native app also needs.

The extracted backend remains explicitly example-specific and private. It must
not move demo identities, R2 policy, or insecure client-selected `subjectId`
behavior into the published `convex-chat` package.

Convex officially supports React Native through the same React client model,
using `EXPO_PUBLIC_CONVEX_URL` in Expo. Expo supports pnpm workspaces and
automatically configures Metro for monorepos on current SDKs. See the
[Convex React Native quickstart](https://docs.convex.dev/quickstart/react-native),
[Expo monorepo guide](https://docs.expo.dev/guides/monorepos/), and
[Convex project configuration](https://docs.convex.dev/production/project-configuration).

HeroUI Native is a reasonable accelerator because its official scaffold uses
Expo and its component set covers the ordinary controls this example needs. It
also has an Expo Go preview. Its documentation currently advises against using
HeroUI Native for Expo web, so the existing Next.js UI remains the browser
experience. See the
[HeroUI Native quick start](https://heroui.com/en/docs/native/getting-started/quick-start).

## Goals

- Demonstrate that `convex-chat` works in a real React Native application, not
  merely through React Native Web.
- Let a developer run the browser as Alice and a physical phone as Bob or
  Charlie and chat between them in realtime.
- Exercise the currently supported example behavior: inbox summaries, unread
  counts, text, presence, typing, replies, reactions, edits, deletion, images,
  and voice messages.
- Maintain one source of truth for host functions and generated Convex API
  types.
- Make Expo Go the zero-native-build path for local development on both iOS
  and Android.
- Show platform-appropriate mobile navigation, gestures, keyboard handling,
  safe areas, permissions, and app lifecycle behavior.
- Keep setup understandable for a developer evaluating `convex-chat`.

## Non-goals

- A published React Native UI kit or a shared cross-platform component system.
- Pixel parity between the Next.js and native apps.
- Expo web as a third supported frontend. The browser test client is Next.js.
- Production authentication. The Alice/Bob/Charlie identity selector remains
  intentionally insecure demo plumbing and must be labelled as such.
- Push notifications, background message delivery, app-store packaging, EAS
  deployment, deep links, or OS badge counts.
- Offline mutation queues beyond the behavior already provided by the Convex
  client and idempotent `clientMessageId` values.
- Replacing R2 or changing the public `convex-chat` component API.

## Users and primary scenario

The primary user is a developer evaluating whether `convex-chat` can support a
web and native product from one Convex backend.

The golden scenario is:

1. The developer starts one Convex dev deployment.
2. The developer starts the Next.js example and opens it in a desktop browser.
3. The developer starts Metro and opens the native example in Expo Go on a
   phone on the same network, or through an Expo tunnel.
4. The browser selects Alice and the phone selects Bob.
5. Both open the Alice–Bob conversation.
6. Text, typing, online state, replies, edits, reactions, deletions, images,
   voice messages, and unread counts update across the two clients.

The clients do not connect directly to each other. The phone only needs local
network or tunnel access to Metro to load the JavaScript bundle; both clients
communicate with the shared cloud Convex deployment over the internet.

## Proposed repository structure

```text
apps/
  example/                         # existing Next.js browser client
    app/
    .env.example
  example-native/                  # new Expo + React Native client
    app/
      _layout.tsx
      index.tsx                    # inbox and demo identity
      conversation/[id].tsx       # native chat screen
    src/
      components/
      hooks/
      lib/
    app.json
    metro.config.js
    global.css
    .env.example
    package.json
packages/
  convex-chat/                     # existing published component
  example-backend/                 # new private deployable host package
    convex/
      _generated/
      attachments.ts
      chat.ts
      convex.config.ts
      schema.ts
    convex.json
    package.json
    .env.example
```

`@convex-chat/example-backend` must be marked `private: true`. It should export
the generated public API from a stable subpath such as
`@convex-chat/example-backend/api`. The web and native packages depend on it
using `workspace:*`.

The backend package owns `convex dev`, backend typechecking, and codegen. The
frontend apps must not contain duplicate host function files. The existing
deployment must be retained when moving its local Convex configuration so that
the refactor does not silently create a second project or erase the useful
shared demo data.

## Local configuration and commands

The backend `.env.local` is the local source of truth for
`CONVEX_DEPLOYMENT` and `CONVEX_URL`. Convex chooses framework-specific public
variable names based on the package in which its CLI runs, so each frontend
must be configured explicitly by the developer. Manually copy the public URL
to:

- Set `NEXT_PUBLIC_CONVEX_URL` in `apps/example/.env.local`; and
- set `EXPO_PUBLIC_CONVEX_URL` in `apps/example-native/.env.local`.

All three local environment files remain ignored. Repository scripts must not
create, migrate, or update `.env.local` files.

Recommended root commands:

```sh
pnpm convex:dev
pnpm dev:example
pnpm dev:example-native
```

After first-time Convex setup, a convenience `pnpm dev:examples` command may
run the backend, web app, and Expo app together, but separate commands must
remain documented because they make failures and QR-code output easier to
understand.

The native development script should run `expo start`. Document `--lan` as the
default physical-device path and `--tunnel` as the fallback when local network
discovery or firewall rules prevent the phone from reaching Metro.

## Native technical direction

### Platform and navigation

- Use the current Expo SDK that is compatible with the current Expo Go store
  release at implementation time; do not copy an outdated version from this
  PRD.
- Use Expo Router with a native stack.
- Do not use a tab navigator. The application has exactly two primary routes in
  the initial version: the inbox and a conversation.
- Use a one-column phone flow: inbox first, then conversation. A tablet split
  view is optional and must not delay the first version.
- Respect safe-area insets and native back navigation.
- Use `KeyboardAvoidingView` or the current Expo-recommended equivalent so the
  composer remains visible on iOS and Android.
- Keep the composer draft, reply target, and edit target stable through
  ordinary keyboard and modal interactions, and clear them when identity or
  conversation changes.

### Inbox/home screen

- Make the home route a focused list of the current identity's conversations.
  The list itself is the screen's primary and only product surface.
- Do not add bottom tabs, a floating new-chat/action button, search, filters,
  filter chips, archived rows, pinned sections, a camera action, or a three-dot
  menu. The example does not implement the product capabilities those controls
  would imply.
- Keep the home header simple: `convex-chat` as the title and the compact
  Alice/Bob/Charlie demo identity selector required by this example. The
  identity selector is explicitly demo tooling, not a general inbox action.
  Do not add any trailing icon actions.
- Render each conversation as a full-width touch row with avatar or initials,
  conversation title, last-message preview, direct/group context when useful,
  and unread badge. Tapping anywhere on the row opens the conversation.
- Include only deliberate loading, empty, and recoverable error states around
  the list. Do not fill empty space with promotional or unsupported actions.

### Convex integration

- Initialize `ConvexReactClient` once from `EXPO_PUBLIC_CONVEX_URL` and wrap the
  router in `ConvexProvider`.
- Import `api` only from `@convex-chat/example-backend/api`.
- Use the same queries, mutations, and actions as the web client.
- Generate `clientMessageId` on the device for every text or attachment send.
- Call the existing idempotent `ensureDemo` mutation at startup.
- Show an actionable setup screen when the public Convex URL is absent instead
  of crashing during module evaluation.

### Presence and app lifecycle

Port the behavior of `use-chat-presence` rather than sharing a DOM-dependent
hook. The native hook must:

- maintain app-wide online and conversation presence sessions;
- send typing updates with the existing debounce/expiry behavior;
- stop typing and disconnect a conversation session when leaving a chat or
  changing identity;
- use React Native `AppState` to suspend heartbeats while backgrounded and
  re-establish presence when active; and
- tolerate reconnects without multiplying heartbeat timers.

Background presence is not part of this example. A backgrounded app should
eventually appear offline according to the component's existing expiry rules.

### UI system

Use HeroUI Native where it reduces undifferentiated component work. Prefer
granular imports, as recommended by HeroUI, to avoid pulling the entire library
into the bundle.

Candidate HeroUI Native components include:

- `Avatar`, `Button`, `Chip` or `Badge`, `Skeleton`, and `Alert`;
- `Menu` for overflow message actions;
- `TextArea` or `TextField` for the composer; and
- `Toast` for recoverable mutation and upload errors.

Use React Native primitives for `FlatList`, message row layout, touch/long-press
handling, keyboard behavior, and any chat surface where a generic component
adds friction. Use `lucide-react-native` or Expo-compatible vector icons, but
verify that only Expo Go-compatible native dependencies are introduced.

HeroUI Native is an implementation dependency, not part of the example's
teaching contract. Wrap it behind local components when useful so a future
upgrade or replacement does not touch chat state logic.

### Messages and mobile interactions

- Render history in a virtualized list with stable message IDs.
- Open at the newest message and remain pinned when the user is already near
  the bottom.
- Do not force-scroll when the user is reading older messages; provide a
  “new messages” affordance instead.
- Mark read through the latest visibly reached message, with a first version
  allowed to mark through the newest message when the active chat is opened.
- In the normal, unselected state, keep the conversation header deliberately
  minimal: native back navigation, conversation avatar or initials, title, and
  an optional non-interactive presence/member subtitle. Leave the trailing
  action area empty. Do not show placeholder video-call, phone, camera, or
  three-dot icons because the example has no corresponding actions.
- Long-pressing a published message enters a selected-message mode inspired by
  the supplied WhatsApp references. Visually highlight the selected message
  across its row and keep the rest of the conversation visible; do not open a
  generic bottom sheet.
- Anchor a floating reaction strip next to or immediately above the selected
  bubble. Show the component's six allowlisted reactions (`👍`, `❤️`, `😂`,
  `😮`, `😢`, and `🙏`) with touch targets large enough for one-handed use.
  Selecting the user's current reaction removes it; selecting another adds or
  replaces it, then exits selected-message mode. Do not show an arbitrary emoji
  “plus” action until the backend reaction allowlist supports it.
- Replace the normal conversation header while a message is selected. The
  contextual header contains a close/back action, selection count (`1` in the
  initial single-selection implementation), primary eligible actions, and a
  three-dot overflow menu. Back must leave selection mode before navigating
  away from the conversation.
- Keep reply as a primary header action. Show delete as a primary action only
  for the current user's published message. Put copy in overflow when the
  message has text, and edit in overflow when the current user owns editable
  text. Do not imitate unsupported WhatsApp actions such as star, forward, pin,
  or security info merely to fill the header.
- Dismiss selected-message mode after an action, when the user taps outside the
  selected row/reaction/header surfaces, when the selected message disappears
  or becomes a tombstone through realtime state, or when identity/conversation
  changes. Choosing edit exits selection mode and enters the dedicated edit
  mode defined below; choosing reply exits selection mode and opens reply
  context.
- Keep the selected message stable while its overflow menu is open. The menu is
  anchored to the header's three-dot action and must not obscure or move the
  selected bubble.
- The initial version selects one message at a time. The count in the contextual
  header preserves a path to future multi-select, but multi-message actions are
  outside this PRD.
- Show reply context immediately above the composer. Edit mode uses the message
  itself as its visual context rather than adding a second edit-context card.
- Preserve tombstones, edited indicators, author labels in groups, timestamps,
  date separators, and reaction summaries.
- Ensure controls have accessibility labels and minimum touch targets. Expose
  the same eligible message operations through React Native accessibility
  actions so long press is not the only discoverable path. Announce selection,
  typing, and errors without repeatedly interrupting screen readers.

### Composer and keyboard

- Use one trailing circular action slot beside the text input. When the trimmed
  draft is empty, show the microphone action in that slot. As soon as the draft
  contains a non-whitespace character, replace the microphone with the send
  action; never show both simultaneously.
- The empty-state microphone is the push-to-talk control defined below. A
  whitespace-only draft behaves as empty. While editing an existing message,
  reserve the trailing action for save/send and keep it disabled until the edit
  contains valid text; do not expose the microphone in edit mode.
- Keep any image-picker affordance inside the composer and visually secondary.
  Do not add a separate camera action. The mic/send state transition must remain
  the obvious primary action.
- Use a multiline native input that grows with content up to a bounded height
  of roughly four or five lines, then scrolls internally. The trailing action
  stays aligned to the bottom edge as the input grows.
- Focusing the input must resize or translate the conversation viewport so the
  composer sits immediately above the software keyboard and the newest message
  remains visible above the composer. The keyboard must not cover the composer,
  reaction/reply context, or final message, and safe-area plus keyboard insets
  must not be applied twice.
- Coordinate the list scroll after the keyboard's shown/frame-change event and
  after composer height changes rather than guessing a fixed keyboard height.
  When the conversation is already at the bottom, keep it pinned through the
  transition. If the user is intentionally reading older history, preserve
  their visible position and show the existing new-message/bottom affordance
  instead of jumping them unexpectedly.
- Entering reply mode focuses the input and brings its composer context plus the
  bottom of the chat into view. Entering edit mode follows the separate target
  positioning rules below. Entering selected-message mode, starting
  push-to-talk, changing conversation or identity, and navigating back dismiss
  the keyboard cleanly.
- Allow interactive or drag keyboard dismissal from the message list while
  preserving normal scrolling and message long-press gestures. Tapping the
  composer focuses it; tapping unused conversation space dismisses it without
  sending or clearing the draft.
- Sending text keeps the keyboard open for rapid follow-up messages, prevents
  duplicate submission while that send is being accepted, clears the committed
  draft, and restores a recoverable draft if the mutation fails. The native
  keyboard return key inserts a newline for the multiline composer; the visible
  send action performs submission.
- Do not autofocus the composer merely by opening a conversation. Test keyboard
  behavior with both iOS and Android keyboards, small screens, large font/text
  scaling, reply/edit context, and the composer at its maximum height.

### Edit mode

- Choosing Edit from a selected message leaves selected-message mode and enters
  a dedicated edit mode for that one message.
- Replace the conversation header with a simple edit header containing a back
  action and the title “Edit message.” Leave its trailing action area empty.
- Dim the rest of the conversation while keeping the edited message at normal
  emphasis. Other messages and reactions are non-interactive while editing;
  the edited message itself is the visual context, so do not render a separate
  “Editing message” card or Cancel button above the composer.
- After the keyboard is measured, scroll the edited message into view directly
  above the composer/keyboard region, even when it began far back in history.
  Recalculate its position as the multiline editor grows so the target message
  and editor remain visible together. This target takes precedence over keeping
  the newest message visible during edit mode.
- Prefill the composer with the current editable text, focus it, and place the
  caret at the end. Replace the normal mic/send affordance with a checkmark save
  action. Disable save for empty/whitespace-only or unchanged text and prevent
  duplicate revision submissions.
- The edit-header back action and Android system back both cancel edit mode in
  one action: discard the unsaved edit draft, dismiss the keyboard, remove the
  dimming, and restore the normal conversation header. On iOS, the header back
  action and interactive navigation attempt must cancel edit mode before the
  conversation route can be popped. Do not require a separate Cancel control or
  make the user dismiss the keyboard first.
- Tapping the dimmed conversation does not save, cancel, or change the edit
  target. Successful revision-safe save exits edit mode, dismisses the keyboard,
  removes dimming, and leaves the updated message visible. A save failure keeps
  edit mode and the draft intact with a recoverable error.
- If realtime state deletes, redacts, or changes the revision of the target
  before save, do not overwrite it. Exit or refresh edit mode with an explicit
  conflict message according to the returned backend error.
- Preserve the list position from before edit mode when practical so canceling
  does not strand the user at an unrelated point in history. Screen readers
  should announce “Edit message” and restrict traversal to the edit header,
  target message, composer, save action, and error state while the rest is
  visually dimmed.

### Images, audio, and R2

Feature parity includes image and voice-message upload and rendering.

- Use `expo-image-picker` for selecting an image.
- Use `expo-audio` for recording and playing voice messages.
- Present voice recording as push-to-talk when the text composer is empty:
  pressing and holding the microphone starts recording, and releasing it stops
  recording and immediately begins upload and message commit without a second
  confirmation tap.
- While held, replace the normal composer state with an obvious recording
  state showing elapsed time, a live/animated indicator, the two-minute limit,
  and a “slide to cancel” affordance. Crossing the cancel threshold and then
  releasing must discard the recording instead of sending it.
- Treat very short touches as accidental: do not send clips shorter than 500
  milliseconds, and briefly show “Hold to record.” Once a valid recording is
  released, show a local pending/sending voice bubble immediately while the
  file uploads; replace it with the committed Convex message or a retryable
  failure state. “Immediately send” means no preview or confirmation step, not
  that the upload has already completed.
- Preserve the active reply target when sending a voice message. The push-to-talk
  control is unavailable while the text composer contains non-whitespace text.
- If the two-minute limit is reached while the control is still held, stop and
  send the valid recording automatically. If recording is interrupted by
  permission denial, an audio-session error, identity or conversation change,
  app backgrounding, or unmount, discard it and do not send partial audio.
- Request microphone permission on the first deliberate interaction. Because
  the operating-system permission dialog can interrupt the gesture, the first
  attempt may end after granting permission and instruct the user to hold again;
  it must never send a partial permission-prompt recording.
- Use `expo-file-system` and `expo/fetch` where needed to PUT a local file to
  the existing signed R2 upload URL.
- Preserve the backend's current 10 MB file limit and two-minute audio limit.
- Pass the device-reported media type, file size, filename, and recording
  duration through the existing upload grant and commit flow.
- Render signed image URLs with the native image component and signed audio URLs
  with the Expo audio player.
- Request permissions only when the user initiates image selection or audio
  recording and explain denials with a recoverable action.
- Stop and release recording/playback resources on unmount, identity change,
  conversation change, and relevant app lifecycle transitions.

The relevant Expo modules are documented as Expo Go-compatible, and Expo's
filesystem API supports uploading a `File` with `expo/fetch`; see
[ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/),
[Audio](https://docs.expo.dev/versions/latest/sdk/audio/), and
[FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/).

Do not add background recording, media-library saving, or native configuration
plugins in the baseline. Those options would change the Expo Go promise.

## Functional requirements

### P0: required for completion

| Area           | Requirement                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup          | One documented Convex deployment and public URL feed both clients.                                                                                                                                                             |
| Identity       | Alice, Bob, and Charlie can be selected; the UI clearly warns that this is demo-only identity.                                                                                                                                 |
| Inbox          | Show a plain list of direct and group conversations with title, preview, kind, unread count, and loading/empty states; no tabs, search/filter UI, floating action, camera, or overflow menu.                                   |
| Realtime       | Messages and conversation summaries update without manual refresh across web and native clients.                                                                                                                               |
| Text           | Send idempotent text messages and show recoverable errors.                                                                                                                                                                     |
| Composer       | Empty or whitespace-only input shows push-to-talk; typing swaps the same trailing slot to send, multiline growth is bounded, and edit mode never exposes the microphone.                                                       |
| Keyboard       | Focus brings the composer and newest relevant chat content above the keyboard without overlap, double insets, or unwanted scroll jumps; dismissal preserves the draft.                                                         |
| Presence       | Show online/offline and typing state across clients, respecting native foreground/background state.                                                                                                                            |
| Read state     | Opening/reading a conversation advances unread state and updates the other conversation summaries.                                                                                                                             |
| Replies        | Reply to a message and render its deletion-safe quote snapshot.                                                                                                                                                                |
| Reactions      | Long press selects and highlights a message, opens its anchored six-emoji reaction strip, and allows adding, replacing, or removing an allowlisted reaction.                                                                   |
| Default header | With no selected message, show only back navigation and conversation identity/status; render no trailing action icons.                                                                                                         |
| Message menu   | Selection replaces the conversation header with count, eligible primary actions, and a three-dot overflow menu; back or outside tap dismisses it before navigation.                                                            |
| Edit mode      | Dim all chat content except the target, position that message immediately above the keyboard/editor, use an “Edit message” header and checkmark save, and let back cancel without a separate Cancel control.                   |
| Lifecycle      | Authors can revision-safely edit text and delete their own messages into tombstones.                                                                                                                                           |
| Images         | Pick, upload, display, expand, and reply/react to image messages.                                                                                                                                                              |
| Voice          | Hold the microphone to record; release to upload/send immediately, slide to cancel, enforce the two-minute limit, render pending/error state, play/pause received audio, display duration, and clean up recorder/player state. |
| UX             | Safe areas, keyboard, loading, offline/reconnect, permissions, and mutation errors have deliberate states.                                                                                                                     |
| Expo Go        | The complete P0 flow works without a custom native build.                                                                                                                                                                      |
| Browser/device | Alice in the existing Next.js app and Bob in Expo Go can complete the golden scenario.                                                                                                                                         |

### P1: valuable follow-up

- Tablet two-pane layout.
- Persist the last selected demo identity and conversation locally.
- Share or save downloaded attachments using Expo-provided APIs.
- A dedicated full-screen image viewer with zoom.
- Automated device end-to-end tests through Maestro or a similar runner. These
  may use a development build even though the manual example does not require
  one.
- EAS preview builds and QR links for reviewers.

## Expo Go compatibility gate

Expo Go contains a fixed set of native modules; libraries with native code that
is not bundled into Expo Go require a development build. Expo documents this
boundary in its
[third-party library guidance](https://docs.expo.dev/workflow/using-libraries/)
and [development build overview](https://docs.expo.dev/develop/development-builds/introduction/).

Before accepting any dependency, verify all of the following:

1. It is JavaScript-only, part of React Native core, part of the matching Expo
   SDK, or explicitly supported in Expo Go.
2. It does not require a config plugin or native project edits for the behavior
   used by this example.
3. Its installed version matches the selected Expo SDK.
4. It does not introduce a duplicate React, React Native, Reanimated,
   Gesture Handler, Worklets, Safe Area, or SVG runtime in the pnpm workspace.
5. The application starts on both current iOS and Android Expo Go clients.

HeroUI Native's mandatory peers include Reanimated, Gesture Handler, Worklets,
Safe Area Context, and React Native SVG. The implementation must use versions
compatible with the chosen Expo SDK and verify the assembled dependency graph
with `pnpm why` and `expo-doctor`. If HeroUI Native fails this gate, retain the
same product requirements and replace only the generic UI layer with React
Native primitives; do not abandon Expo Go for styling convenience.

## Testing and verification

### Automated

- Keep backend behavior covered by the existing Convex tests after extraction.
- Add unit tests for native formatting, identity guards, previews, message
  action eligibility, upload metadata normalization, and presence timer state.
- Add React Native Testing Library tests for inbox loading/empty/content states,
  absence of tabs/search/floating and unsupported home actions, empty/whitespace
  mic state, typed send state, multiline and reply composer state, draft
  preservation across keyboard dismissal, edit-mode dimming and target
  positioning, checkmark eligibility, single-action back cancellation and
  revision failure, tombstones, the empty trailing area in the default
  conversation header, selected-message highlighting, contextual-header
  eligibility, reaction-strip toggle/replace behavior, overflow dismissal,
  back handling, push-to-talk press/release/cancel transitions,
  minimum-duration handling, and permission or upload failures.
- Mock Convex hooks at the screen boundary; do not duplicate backend invariant
  tests in UI tests.
- Add `typecheck` and `test` scripts so Turborepo includes the new app and
  backend package in root verification.
- Run `expo-doctor` as a native compatibility check.

### Manual cross-client acceptance

Run this matrix before declaring the example complete:

| Browser client     | Native client               | Required result                                                                                                                                                                                                         |
| ------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alice, direct chat | Bob, same direct chat       | Bidirectional text, typing, and online state synchronize; long press highlights one native message and exposes its reaction strip plus eligible header/overflow actions; reaction, reply, edit, and delete synchronize. |
| Alice, browser     | Bob, keyboard open          | Empty native input shows mic; typing swaps it to send; focus lifts the composer and newest message above the keyboard; multiline/reply growth stays visible; send keeps focus; dismissing preserves the draft.          |
| Alice, browser     | Bob, editing older message  | Native chat dims except the target, scrolls that message directly above the keyboard/editor, shows checkmark save and “Edit message” header, and system/header back cancels edit in one action with no Cancel button.   |
| Alice, group chat  | Charlie, same group chat    | Author labels, member counts, typing, and group messages synchronize.                                                                                                                                                   |
| Alice, active chat | Bob, inbox then chat        | Bob receives an unread increment, opens the chat, and clears it.                                                                                                                                                        |
| Alice, browser     | Bob, phone                  | Holding and releasing the native microphone sends one voice message without confirmation; cancel sends none; the committed audio renders and plays on both clients.                                                     |
| Alice, browser     | Bob, app backgrounded       | Bob expires offline; returning to foreground reconnects without duplicate presence.                                                                                                                                     |
| Either             | Phone loses/rejoins network | UI recovers, does not duplicate an idempotent send, and resumes realtime updates.                                                                                                                                       |

At minimum, run the golden scenario on one physical phone in Expo Go and a
desktop browser. Before merging, also smoke-test the other mobile OS using a
physical device or simulator with a matching Expo Go runtime.

## Delivery phases

### Phase 1: shared backend boundary

- Create `packages/example-backend` and move the existing Convex host intact.
- Export the generated API from a stable package subpath.
- Update the Next.js imports and scripts without changing user-visible web
  behavior.
- Document explicit public-URL configuration for both clients without writing
  local environment files from repository scripts.
- Prove the existing web example, backend tests, typecheck, and build still pass.

### Phase 2: native text-chat vertical slice

- Scaffold the Expo Router app inside the existing pnpm workspace.
- Configure HeroUI Native and providers.
- Implement setup state, demo identity, inbox, conversation screen, realtime
  text, unread state, presence, and typing.
- Prove the Alice-browser/Bob-phone text scenario in Expo Go.

### Phase 3: full message behavior

- Add replies, selected-message highlighting, anchored reaction strip,
  contextual action header and overflow menu, copy, edit, delete, tombstones,
  group author labels, scroll behavior, and accessibility.
- Add image selection/upload/viewing.
- Add voice recording/upload/playback and resource cleanup.
- Complete automated tests and the manual cross-client matrix.

### Phase 4: documentation and polish

- Update the root README workspace table and run instructions.
- Add a native example section to getting-started documentation.
- Document Expo Go, LAN/tunnel troubleshooting, permissions, and R2 setup.
- Capture current screenshots only after the UI is stable.

## Risks and mitigations

| Risk                                                              | Mitigation                                                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| HeroUI Native or a peer falls outside the current Expo Go runtime | Pin Expo-compatible versions, run `expo-doctor`, smoke-test both OSes, and fall back to local React Native primitives if necessary.                |
| pnpm resolves duplicate native runtimes                           | Declare every dependency explicitly, inspect `pnpm why`, and change workspace linker settings only if a reproduced Metro/native issue requires it. |
| Backend extraction accidentally selects a new Convex deployment   | Move and verify local deployment configuration deliberately; compare the deployment URL and existing demo data before and after.                   |
| The two apps drift onto different URLs                            | Treat backend `CONVEX_URL` as the local source and generate both public frontend variables with one safe script.                                   |
| Native presence remains online after backgrounding                | Drive session lifecycle from `AppState`, cancel timers, and test expiry/reconnect explicitly.                                                      |
| Mobile signed uploads differ from browser `Blob` behavior         | Use Expo `File`/`expo/fetch`, validate size and media type before grants, and test real iOS and Android uploads against R2.                        |
| Chat list jumps as realtime messages or images arrive             | Use stable keys, virtualized-list positioning rules, and a new-message affordance when the user is away from the bottom.                           |
| Demo identity is mistaken for production auth guidance            | Keep the warning on both screens and repeat the host-auth boundary in docs.                                                                        |

## Completion criteria

The initiative is complete when:

- the web and native clients consume one private example-backend package and
  one generated API;
- both clients point at one Convex deployment through documented local setup;
- the native P0 scope works in Expo Go without generated native projects;
- a browser user and phone user can exercise the full cross-client chat flow,
  including images and voice messages;
- existing web behavior and reusable component boundaries have not regressed;
- root format, test, typecheck, and build checks pass, plus `expo-doctor` and the
  manual device matrix; and
- the README and getting-started documentation describe the two-client workflow
  and the intentionally insecure demo identity boundary.
