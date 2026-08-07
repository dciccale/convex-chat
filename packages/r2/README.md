# @convex-chat/r2

Optional Cloudflare R2 storage adapter for `convex-chat` attachments. It wraps
`@convex-dev/r2` behind the provider-neutral `ChatStorageAdapter` contract.

Credentials remain in the consuming host application's Convex environment;
they are never passed to or stored by the chat component.
