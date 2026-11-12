<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cache Components

`next.config.ts` sets `cacheComponents: true`. Do not export the route segment configs `dynamic`, `revalidate`, `fetchCache`, or `dynamicParams`. The build fails with: Route segment config "…" is not compatible with `nextConfig.cacheComponents`.

To run a route handler or server function at request time, call `await connection()` from `next/server` inside that function. Do not add `export const dynamic = "force-dynamic"`.

## Commits

Name every commit with a Conventional Commits subject:

`type(optional scope): summary`

Use `feat`, `fix`, `docs`, `test`, `refactor`, or `chore`. The summary is imperative.

## Pull requests

Do not create a pull request unless the user asks for one. Commit and push the branch when the work is ready, and stop there. Updating a pull request the user already asked for is fine.
