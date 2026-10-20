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

## Interface conventions

- New UI is built from the design tokens and primitives that `/design` shows. A transparent control (an icon button, a heading that opens a list) is built from the ghost button, so it hovers with the state layer rather than a hover of its own.
- Every h1, and every back link that names one, is in title case ("All Recipes", "Back to All Recipes"); a back link that names no heading ("Back to search results") is not.
- A submit button is never disabled for what its form holds. An empty required field shows its error at the field at once, checked in the browser before any request, and what a form said after an attempt lasts only while its page is shown.
- Page actions (a form's buttons, a section's lone button) align left; dialogs keep right-aligned footers.
- Hints sit below their inputs. A page form spaces its alert, its fields, and its actions row 16 px apart, with fields 28 px apart in a `FieldGroup`.
- A chevron turns only on an in-place disclosure (a collapsible, a details element); a popup's trigger (a menu, a select, a combobox) keeps it still.
- Actions on a whole recipe or draft live in a ⋯ menu beside its heading or at the end of its row, even when the menu holds one action, and a row opens by being a link.

## Testing

- Component tests (`*.test.tsx`) run in Vitest's browser project, in Chromium, Firefox, and WebKit. Drive them with Vitest's locators and `userEvent`, never with hand-built events.
- End-to-end flows live in `e2e/` and use its support: each test creates the member it signs in as and deletes it, along with everything it wrote.
- Every `ul` and `ol` takes `role="list"`, which ESLint enforces, because Safari drops the list semantics of a list styled without markers.
- Restart a running `pnpm dev` after a dependency change, since the end-to-end suites reuse it.
- Tests and checks by hand run against the dev server on Neon's `develop` branch or a preview, never against production's content.

## Issues

GitHub Issues hold planned features. A defect is fixed in the change that finds it, and is filed as an issue only when the owner agrees to defer it.
