# Operations

## Builds

Every Vercel build migrates its database over a direct connection, makes the owner an admin, seeds, and only then runs `next build`. Outside production, each of these steps refuses production's database ([Infrastructure](Infrastructure.md#neon)).

- **Migrations** apply before the new code goes live, while the previous deployment keeps serving, so every migration is backward compatible: add first, and remove in a later deployment.
- **The owner** is the account at `ADMIN_EMAIL`, which every build makes an admin, creating it if needed. No one can remove it or take its admin role, and only the owner removes another admin's role or account. Changing `ADMIN_EMAIL` moves ownership to the new address's account once the next deployment goes live (until then the previous deployment still treats the old address as the owner), and the previous owner stays an admin until the new owner removes that role.
- **The seed** skips production. Elsewhere it adds whatever is missing of the synthetic sample recipes and their photos, credited to a "Sample contributor" member. On a preview it also deletes the sign-in records the branch copied from production, so production's sessions never work there.

## Scheduled and triggered jobs

- **Daily cleanup.** A Vercel cron calls production's cleanup route at 09:00 UTC with `CRON_SECRET` as its bearer token, and the route answers 404 on every other deployment. It settles imports that were interrupted, deletes records past their lifetime, then runs the image sweep. A failed step leaves its work for the next day's run. To run it now, use `vercel crons run /api/cron/cleanup`.
- **Image sweep.** In its own deployment's folders only, it moves back any trashed image a recipe or draft names again, moves uploads nothing names to the trash once their lifetime passes, and deletes trash past its lifetime. Production sweeps in the daily cleanup. Previews and the dev server have no cron, so they sweep after every recipe or import write instead and leave expired records in place, which every reader ignores. On every deployment, an edit or delete also removes the photos it let go once its response is sent.
- **Preview cleanup** (GitHub Actions). When a pull request closes or a branch is deleted, and daily for every branch gone from GitHub or idle past the project's preview retention, its first job deletes the branch's previews with `VERCEL_TOKEN`, and the Neon integration then deletes the branch's Neon branch. Its second job deletes those branches' image folders in the preview store with `PREVIEW_BLOB_TOKEN`; daily, it also deletes any folder whose branch has no preview left. It never deletes a Git branch, and a later push builds a fresh preview and Neon branch. A run that could not delete something fails and names it; rerun it from the repository's Actions tab, where it can also be run on demand.
- **CI** (GitHub Actions) runs `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit` on every pull request and push to `main`. A ruleset on `main` admits changes only by pull request, from a branch that is up to date with `main` and whose CI and preview build pass. The owner can merge a pull request that hasn't met these, but no one pushes to `main` directly.
- **Wiki** (GitHub Actions) publishes `docs/` to the repository's wiki on each push to `main` that changes it, or on demand. The wiki is output, so edit `docs/`.

Runtime logs are in the project's Logs in Vercel. They are kept only briefly and nothing alerts, so look soon after anything seems wrong, and since many failures inside a page still answer 200, read the log lines rather than the status codes.

## Rotating secrets

A secret is replaced where it is issued, then set where it is held. `vercel env update <name> <environment> --yes` and `gh secret set <name>` both read the value from standard input, so it never appears on a command line. A Vercel variable takes effect on the environment's next deployment, so redeploy afterwards.

- **`BETTER_AUTH_SECRET`**, per environment: `openssl rand -base64 32 | vercel env update BETTER_AUTH_SECRET production --yes`, then redeploy. A new value signs every member of that environment out and voids any sign-in code still unused; passkeys keep working. Rotate Development's first, then run `vercel env pull` and restart `pnpm dev`.
- **`CRON_SECRET`**, in Production: the same command with `CRON_SECRET`, then redeploy. Vercel sends the current value with each cron request.
- **`VERCEL_TOKEN`**: create a token scoped to the `recipe-hub` project in Vercel's account settings, set it with `gh secret set VERCEL_TOKEN`, and delete the old token.
- **`PREVIEW_BLOB_TOKEN`**: take the preview store's new read-write token from the store's settings in Vercel and set it with `gh secret set PREVIEW_BLOB_TOKEN`.
- **The integrations' credentials** (Neon's database URLs on Production and Preview, and Resend's key) are rotated through the integration's resource in Vercel, which rewrites its variables; then redeploy. Development's database URLs are copied from `develop`'s connection details in the Neon console.

## Restoring the database

Neon can restore `main` to any time in the last 7 days, or to a daily snapshot, each kept 35 days. Removed photos stay in the trash longer than that, so a restored recipe gets its photos back. A restore replaces all of production's data, so first note anything added after the time you restore to.

1. In the Neon console, open Backup & restore for `main`, choose a time before the loss (or a snapshot, with One-step restore), and confirm. The connection strings stay the same, and the previous state is kept as a backup branch.
2. Run the daily cleanup now (`vercel crons run /api/cron/cleanup`). Its sweep moves back every trashed image a restored recipe names.
3. The restore leaves `develop` and the preview branches under the backup branch, which cannot be deleted while it has children. Delete the moved preview branches (the next push to each Git branch builds a fresh one), delete `develop` and create it again from `main`, copy its connection strings into Development's database URLs in Vercel, and run `vercel env pull`. Then delete the backup branch once you are sure of the restore.

## Running a script on production

`pnpm db:reparse-ingredients` compares saved recipes with what the current ingredient tidying and parsing would make of them, and `--write` saves the differences. Vercel won't return production's direct database URL, so copy it from the Neon console (branch `main`, pooling off) into an env file outside the repository as `DATABASE_URL_UNPOOLED` and run `pnpm exec tsx --env-file=<file> --tsconfig scripts/tsconfig.json scripts/reparse-ingredients/reparse-ingredients.ts`, which keeps that URL over the one in `.env.local`. Check the logged database host is production's before a run with `--write`, delete the file afterwards, and redeploy production so the Runtime Cache drops the recipes it held.

## Tests

`pnpm test` runs both suites, one after the other.

- **`pnpm test:unit`** runs Vitest in two projects: tests in Node, where repository tests run against an in-process Postgres (PGlite), and component tests in headless Chromium, Firefox, and WebKit.
- **`pnpm test:e2e`** runs the Playwright suites in `e2e/` on iPhone (WebKit), Pixel (Chromium), and desktop Chromium, against the `pnpm dev` already serving this checkout on port 3000, or one it starts for the run and stops after. They use Neon's `develop`, so run `pnpm db:seed` first. No test spends AI credit, and only the `email` project sends mail, to Resend's test inbox (`pnpm test:e2e --project=email`), which still counts against the daily limit. The suites never run in CI.

Each run writes its results under `test-results/`, which git ignores: Vitest's single-file HTML report, and Playwright's traces and report, which `pnpm exec playwright show-report test-results/playwright/report` opens.
