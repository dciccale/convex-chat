# Changelog

## Unreleased

- Keep web image bubbles fitted to their previews and replace attachment loading
  flashes with stable image and voice-message placeholders.
- Fix voice-message uploads and slide-to-cancel gestures in the Expo native
  example, and show concise user-facing errors instead of Convex stack traces.

- Add a full Expo and React Native chat example with an inbox-only home screen,
  native keyboard handling, message selection and reactions, reply and edit
  flows, image attachments, and press-and-hold voice messages that send on
  release.
- Extract the demo Convex host into a private shared backend package so the
  Next.js and Expo clients use one generated API and deployment.

## 0.1.0-alpha.0 - 2026-08-08

- Link the live demo and documentation from the repository and package READMEs,
  and identify the npm package as a Convex component in its keywords.
- Split the runnable chat example into `apps/example`, add a dedicated
  `apps/web` marketing site with Fumadocs documentation, and rebuild the
  example UI from default shadcn components with responsive conversation and
  message surfaces, loading states, attachment controls, and a custom voice
  message player.
- Make the marketing homepage chat preview interactive with toggleable reactions,
  in-memory message sending, and a web-owned illustrated photo.
- Prepare the repository for its initial open-source release with expanded
  setup, security, contribution, and package documentation.
- Scaffold the Turborepo workspace and Next.js example.
- Add the initial conversation, membership, ordered-message, idempotency, and
  unread-watermark vertical slice.
- Add replies with deletion-safe quote previews, revision-safe edits,
  delete-for-everyone tombstones, and allowlisted reactions.
- Keep an already-sent reply's quote snapshot visible when its source is
  deleted, while allowing the reply itself to be deleted independently.
- Add provider-neutral attachment parts, direct `@convex-dev/r2` integration,
  and access-bound image upload grants in the sample.
- Demonstrate hover actions, context menus, date separators, message times,
  replies, edits, deletion, reactions, and image messages in the example.
- Persist the demo's selected viewer and open conversation in query parameters.
- Keep identity switching stable when the conversation query parameter updates.
- Open the reaction choices reliably from the message actions menu.
- Scroll to the newest message after sending text or an attachment.
- Open every conversation at its latest message, including after switching
  between direct and group chats, and stay pinned while attachments load.
- Remove decorative borders around conversation-list avatars.
- Show voice-message duration in the left timing slot while idle or paused,
  switching that slot to elapsed time only during playback.
- Show sender names and avatars for other participants in group conversations,
  while keeping direct messages free of repeated identity.
- Place voice-message controls directly on the message bubble without a nested
  bordered container.
- Align voice-message timestamps with the duration or playback-time row.
- Constrain voice-message controls to the message bubble at every width.
- Remove the decorative speaker icon from voice messages.
- Preserve sender avatars and names on deleted group messages.
- Distinguish your deleted messages from messages deleted by others.
- Render deleted messages with the standard message bubble treatment.
- Dismiss the full-screen image viewer when its backdrop is clicked.
- Open image attachments in an animated full-app lightbox with reaction, reply,
  Done, and Escape dismissal controls.
- Dismiss message context menus and reaction pickers when clicking outside.
- Focus the composer immediately after selecting a message to reply to.
- Add varied sample attachment images to the runnable example for manual upload
  testing.
- Add tap-to-record voice messages with native browser recording, direct R2
  uploads, and in-chat audio playback to the runnable example.
- Replace the attachment upload ellipsis with an accessible animated spinner.
- Compose `@convex-dev/presence` for membership-checked online and typing state,
  including multi-session aggregation and a realtime runnable example.
- Keep online status app-wide across conversation switches while retaining
  conversation-scoped typing indicators.
- Bound app-wide presence authorization checks to indexed active memberships
  and cover scope isolation, read-only participants, invalid sessions, and
  inactive memberships with regression tests.
- Correct the host API reference to match the exported wrapper names.
- Document the current feature boundary and prioritized messaging roadmap.
- Remove the experimental `ChatStorageAdapter` surface and thin local R2
  package in favor of direct host integration with `@convex-dev/r2`.
- Exclude internal test modules from the published package, register nested
  Presence test components, and cover the exported test registrar.
- Clean package build output before compilation so stale internal modules cannot
  leak into release tarballs.
- Guard prerelease publishing against the npm `latest` tag and document the
  explicit `next` release command.
- Remove unused example UI modules and no-op documentation test scaffolding.
- Keep `apps/web` and `apps/example` isolated by removing the marketing app's
  import of an example-owned image asset.
- Prepare `0.1.0-alpha.0` for the npm `next` tag after the published `0.0.1`
  package-name reservation.
