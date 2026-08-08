# Contributing

Thanks for helping improve `convex-chat`. Issues, design feedback, documentation
fixes, and focused pull requests are welcome.

## Development setup

Use Node.js 20 or newer and pnpm 10.

```sh
git clone git@github.com:dciccale/convex-chat.git
cd convex-chat
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

To run the examples, start their shared Convex backend first:

```sh
pnpm --filter convex-chat build:codegen
pnpm convex:dev
```

After first-time Convex setup, manually add its public `CONVEX_URL` to each
client's ignored environment file:

```dotenv
# apps/example/.env.local
NEXT_PUBLIC_CONVEX_URL=https://your-development-deployment.convex.cloud

# apps/example-native/.env.local
EXPO_PUBLIC_CONVEX_URL=https://your-development-deployment.convex.cloud
```

Start either or both clients in separate terminals:

```sh
pnpm --filter @convex-chat/example dev
pnpm --filter @convex-chat/example-native start
```

## Project boundaries

`convex-chat` is an independent open-source Convex component. Keep application
authentication, relationships, and product policy outside the component.

Public component functions must validate arguments and return values. Actor
operations must verify chat-local membership inside the component, even when a
host wrapper has already authenticated the caller. Host table IDs cross the
component boundary as opaque strings.

The publishable package lives in `packages/convex-chat`; the private example
host integration lives in `packages/example-backend`; runnable clients live in
`apps`.

## Pull requests

- Keep changes focused and explain the user or developer impact.
- Add tests for new behavior and security invariants.
- Update documentation when the public API or setup changes.
- Add user-visible changes to the `Unreleased` section of `CHANGELOG.md`.
- Do not commit deployment files, credentials, or `.env.local` files.
- Run the full verification suite before requesting review.

```sh
pnpm format:check
pnpm test
pnpm typecheck
pnpm build
pnpm --filter convex-chat pack --pack-destination /tmp
```

## Publishing a prerelease

Publishing changes npm state and must only happen with the maintainer's explicit
approval. From `packages/convex-chat`, verify the tarball and tag without
publishing:

```sh
pnpm publish:next --dry-run
```

After approval, publish the alpha under the `next` dist-tag:

```sh
pnpm publish:next
```

The package's publish guard rejects prerelease versions sent to `latest`.

By contributing, you agree that your contributions are licensed under the
Apache License 2.0, as described in [`LICENSE`](LICENSE).
