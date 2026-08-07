# Attachment storage

`convex-chat` stores provider-neutral attachment descriptors. Binary files,
upload authorization, signed download URLs, and provider credentials belong to
the host application.

The web example uses the optional `@convex-chat/r2` adapter over
`@convex-dev/r2`. Upload grants are bound to a demo subject and conversation,
expire after 15 minutes, and are verified again before the attachment message
is committed.

## Cloudflare R2 setup

Create a private R2 bucket using the **Standard** storage class. For this
checkout the suggested bucket name is `convex-chat-dev`.

Create an R2 API token restricted to this bucket with Object Read & Write
permissions. Record its S3 Access Key ID, Secret Access Key, and endpoint. Set
the values directly in the Convex development deployment—do not add them to an
`.env` file or commit them:

```sh
cd apps/web
pnpm exec convex env set R2_BUCKET convex-chat-dev
pnpm exec convex env set R2_ENDPOINT
pnpm exec convex env set R2_ACCESS_KEY_ID
pnpm exec convex env set R2_SECRET_ACCESS_KEY
```

The CLI prompts for omitted values, which keeps secrets out of shell history.
The adapter does not use Cloudflare's displayed Token Value (`R2_TOKEN`).

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

## Provider contract

The core package exports `ChatStorageAdapter`. A storage adapter supplies five
operations:

- create an authorized upload URL;
- synchronize authoritative object metadata;
- read metadata;
- create a short-lived download URL; and
- delete an object.

Message deletion returns the opaque attachment keys that the host should
delete. This keeps R2, native Convex storage, S3, and other providers outside
the durable chat domain.
