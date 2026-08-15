---
title: Attachment storage
description: Keep attachment bytes provider-neutral while preserving conversation authorization.
icon: Paperclip
---

`convex-chat` stores provider-neutral attachment descriptors. Binary files,
upload authorization, signed download URLs, and provider credentials belong to
the host application.

The runnable example uses `@convex-dev/r2` directly for image and recorded-audio
messages. Upload grants are bound to a demo subject and conversation, expire
after 15 minutes, and are verified again before the attachment message is
committed. Audio is encoded in the browser with `MediaRecorder`; the example
does not require a server-side media binary or transcoding step.

## Cloudflare R2 setup

Create a private R2 bucket using the **Standard** storage class. For this
checkout the suggested bucket name is `convex-chat-dev`.

Create an R2 API token restricted to this bucket with Object Read & Write
permissions. Record its S3 Access Key ID, Secret Access Key, and endpoint. Set
the values directly in the Convex development deployment—do not add them to an
`.env` file or commit them:

```sh
cd apps/example
pnpm exec convex env set R2_BUCKET convex-chat-dev
pnpm exec convex env set R2_ENDPOINT
pnpm exec convex env set R2_ACCESS_KEY_ID
pnpm exec convex env set R2_SECRET_ACCESS_KEY
```

The CLI prompts for omitted values, which keeps secrets out of shell history.
The R2 component does not use Cloudflare's displayed Token Value (`R2_TOKEN`).

Add this development CORS policy to the bucket, adjusting origins when the
frontend port or production domain changes:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"]
  }
]
```

Keep the bucket private. The sample generates short-lived, membership-checked
download URLs. Publishing the bucket would bypass conversation access
revocation.

## Host storage responsibilities

The host creates authorized upload URLs, verifies authoritative object
metadata, creates short-lived download URLs, and deletes objects. Message
deletion returns the opaque attachment keys that the host should delete. This
keeps R2, native Convex storage, S3, and other providers outside the durable
chat domain without requiring a provider adapter package from `convex-chat`.

## Reliable retries

Create `clientMessageId` before the first upload attempt. Keep it with the
local pending attachment and reuse the same value for every retry. After the
bytes upload succeeds, also retain that upload grant or storage key. Retry the
commit with the same grant and `clientMessageId`. The component then returns the
existing message if the first commit succeeded but its response did not reach
the client. Request a new grant only when the upload itself did not complete.

Keep the local file URI, attachment metadata, caption, reply target, and
`clientMessageId` together until the send succeeds or the user dismisses it.
The Expo example keeps one pending attachment for the current screen session.
It does not implement an offline queue or restore pending files after restart.

The host storage layer should expire unused upload grants and remove orphaned
objects from failed or superseded upload attempts. `convex-chat` owns message
idempotency. The host application owns upload retry policy and provider cleanup.
