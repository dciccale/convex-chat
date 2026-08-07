# Changelog

## Unreleased

- Prepare the repository for its initial open-source release with expanded
  setup, security, contribution, and package documentation.
- Scaffold the Turborepo workspace and Next.js example.
- Add the initial conversation, membership, ordered-message, idempotency, and
  unread-watermark vertical slice.
- Add replies with deletion-safe quote previews, revision-safe edits,
  delete-for-everyone tombstones, and allowlisted reactions.
- Keep an already-sent reply's quote snapshot visible when its source is
  deleted, while allowing the reply itself to be deleted independently.
- Add provider-neutral attachment parts, an optional Cloudflare R2 adapter, and
  access-bound image upload grants in the sample.
- Demonstrate hover actions, context menus, date separators, message times,
  replies, edits, deletion, reactions, and image messages in the web sample.
- Persist the demo's selected viewer in the `as` query parameter.
- Dismiss message context menus and reaction pickers when clicking outside.
- Focus the composer immediately after selecting a message to reply to.
- Add varied sample attachment images to the web example for manual upload
  testing.
- Replace the attachment upload ellipsis with an accessible animated spinner.
- Compose `@convex-dev/presence` for membership-checked online and typing state,
  including multi-session aggregation and a realtime web example.
