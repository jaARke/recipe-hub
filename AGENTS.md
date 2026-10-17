# Barb’s Table

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Documentation

`docs/` describes how the site is built, where it runs, and how it is operated, and the wiki publishes it. A change to that setup updates its page in the same pull request. Each page is a short snapshot of what exists now, written in terms of layers, modules, and services: it holds no future work and no history, names no function, class, or column, and covers only what reading the code doesn't make obvious.

## Where code goes

[docs/Architecture.md](docs/Architecture.md) names the layers, what each holds, and where new code goes. `pnpm lint:boundaries` enforces the boundaries.

## Testing

- Component tests (`*.test.tsx`) run in Vitest's browser project, in Chromium, Firefox, and WebKit. Drive them with Vitest's locators and `userEvent`, never with hand-built events.
- End-to-end flows live in `e2e/` and use its support: each test creates the member it signs in as and deletes it, along with everything it wrote.
- Every `ul` and `ol` takes `role="list"`, which ESLint enforces, because Safari drops the list semantics of a list styled without markers.
- Restart a running `pnpm dev` after a dependency change, since the end-to-end suites reuse it.
