# Operations

## Builds

Before running `next build`, every Vercel build migrates its database over a direct connection, makes the owner an admin, and seeds. Outside production, each of these steps refuses production's database ([Infrastructure](Infrastructure.md#neon)).

- **Migrations** apply before the new code goes live, while the previous deployment is still serving. As such, every migration has to be backward compatible: add things first, and remove them in a later deployment. The ORM's inserts name every column the schema declares, so the deployment before a removal has to stop naming that column in its inserts, not just its reads.
- **The owner** is the account at `ADMIN_EMAIL`, which every build makes an admin, creating it if needed. No one can remove the owner or take its admin role, and only the owner can remove another admin's role or account. Changing `ADMIN_EMAIL` moves ownership to the new address's account once the next deployment goes live (until then, the previous deployment still treats the old address as the owner). The previous owner stays an admin until the new owner removes that role.
- **The seed** skips production. Everywhere else, it adds whatever is missing of the synthetic sample recipes and their photos, credited to a "Sample contributor" member. On a preview, it also deletes the sign-in records the branch copied from production, so production's sessions never work there.

## Scheduled and triggered jobs

- **Daily cleanup.** A Vercel cron calls production's cleanup route at 09:00 UTC, with `CRON_SECRET` as its bearer token, and the route answers 404 on every other deployment. It settles imports that were interrupted, deletes records past their lifetime (a draft 90 days after its last change, for example), and then runs the image sweep. A step that fails leaves its work for the next day's run. To run it right away, use `vercel crons run /api/cron/cleanup`.
- **Image sweep.** Working only in its own deployment's folders, the sweep moves back any trashed image that a recipe or draft names again, moves uploads nothing names to the trash once their lifetime passes, and deletes trash past its lifetime. Production sweeps as part of the daily cleanup. Previews and the dev server have no cron, so they sweep after every recipe or import write instead, and leave expired records in place for every reader to ignore. On every deployment, an edit or delete also removes the photos it let go of once its response is sent.
- **Preview cleanup** (GitHub Actions) runs when a pull request closes or a branch is deleted, and daily for every branch that's gone from GitHub or idle past the project's preview retention. Its first job deletes the branch's previews with `VERCEL_TOKEN`, and the Neon integration then deletes the branch's Neon branch. Its second job deletes those branches' image folders in the preview store with `PREVIEW_BLOB_TOKEN`, and in the daily run, it also deletes any folder whose branch has no preview left. It never deletes a Git branch, and a later push builds a fresh preview and Neon branch. A run that couldn't delete something fails and names it. You can rerun it, or run it on demand, from the repository's Actions tab.
- **CI** (GitHub Actions) runs `pnpm lint`, `pnpm typecheck`, and `pnpm test:unit` on every pull request and every push to `main`. A ruleset on `main` only admits changes by pull request, from a branch that's up to date with `main` and whose CI and preview build pass. The repository's owner can merge a pull request that hasn't met these, but no one pushes to `main` directly.
- **Dependency updates** (Dependabot). Every Monday, Dependabot opens grouped pull requests for packages and actions released at least a week earlier. It keeps at most three package pull requests open at once, since each one holds a preview and its Neon branch. Next's packages are updated by hand while the README's Next.js patch exists. To bring a pull request that has fallen behind `main` up to date, comment `@dependabot rebase`, because Dependabot stops maintaining a pull request after "Update branch". A bump that brings in a package with a build script fails every install until `allowBuilds` in `pnpm-workspace.yaml` names it, so add it there on `main`, then rebase. Security updates open as advisories appear, without the week's wait. GitHub's dependency graph reads only the first YAML document in `pnpm-lock.yaml`, so `pmOnFail` in `pnpm-workspace.yaml` keeps pnpm from writing its own version in a document ahead of the packages, and pnpm doesn't switch itself to the pinned version. A config dependency would add that document back and hide the packages from alerts.
- **Wiki** (GitHub Actions) publishes `docs/` to the repository's wiki on each push to `main` that changes it, or on demand. The wiki is output, so edit `docs/` instead.

## Logs

Runtime logs are in the project's Logs in Vercel. They're only kept briefly and nothing alerts on them, so look soon after anything seems wrong. Many failures inside a page still answer 200, so read the log lines rather than the status codes.

## Rotating secrets

Replace a secret where it's issued, then set it where it's held. `vercel env update <name> <environment> --yes` and `gh secret set <name>` both read the value from standard input, so it never appears on a command line. A Vercel variable takes effect on the environment's next deployment, so redeploy afterwards.

- **`BETTER_AUTH_SECRET`**, per environment: `openssl rand -base64 32 | vercel env update BETTER_AUTH_SECRET production --yes`, then redeploy. A new value signs out every member of that environment and voids any unused sign-in codes, but passkeys keep working. Rotate Development's first, then run `vercel env pull` and restart `pnpm dev`.
- **`CRON_SECRET`**, in Production: the same command with `CRON_SECRET`, then redeploy. Vercel sends the current value with each cron request.
- **`VERCEL_TOKEN`**: create a token scoped to the `recipe-hub` project in Vercel's account settings, set it with `gh secret set VERCEL_TOKEN`, and delete the old token.
- **`PREVIEW_BLOB_TOKEN`**: take the preview store's new read-write token from the store's settings in Vercel, and set it with `gh secret set PREVIEW_BLOB_TOKEN`.
- **The integrations' credentials** (Neon's database URLs on Production and Preview, and Resend's key) rotate through the integration's resource in Vercel, which rewrites its variables. Redeploy afterwards. Development's database URLs are copied from `develop`'s connection details in the Neon console.

## Restoring the database

Neon can restore `main` to any point in the last 7 days, or to one of its daily snapshots, which are kept for 35 days. Removed photos stay in the trash longer than that, so a restored recipe gets its photos back. A restore replaces all of production's data, so first note anything added after the time you're restoring to.

1. In the Neon console, open Backup & restore for `main`, choose a time before the loss (or a snapshot, with One-step restore), and confirm. The connection strings stay the same, and the previous state is kept as a backup branch.
2. Run the daily cleanup right away (`vercel crons run /api/cron/cleanup`). Its sweep moves back every trashed image a restored recipe names.
3. Clean up the branches. The restore leaves `develop` and the preview branches under the backup branch, which can't be deleted while it has children.
   - Delete the moved preview branches. The next push to each Git branch builds a fresh one.
   - Delete `develop` and create it again from `main`, copy its connection strings into Development's database URLs in Vercel, and run `vercel env pull`.
   - Once you're sure of the restore, delete the backup branch.

## Running a script on production

`pnpm db:reparse-ingredients` compares saved recipes with what the current ingredient tidying and parsing would make of them, and `--write` saves the differences. Vercel won't return production's direct database URL, so running it on production takes a few steps:

1. Copy the URL from the Neon console (branch `main`, pooling off) into an env file outside the repository, as `DATABASE_URL_UNPOOLED`.
2. Run `pnpm exec tsx --env-file=<file> --tsconfig scripts/tsconfig.json scripts/reparse-ingredients/reparse-ingredients.ts`, which uses that URL over the one in `.env.local`. Before a run with `--write`, check that the logged database host is production's.
3. Delete the env file afterwards, and redeploy production so the Runtime Cache drops the recipes it held.

## Tests

`pnpm test` runs both suites, one after the other.

- **`pnpm test:unit`** runs Vitest in two projects: tests in Node, where repository tests run against an in-process Postgres (PGlite), and component tests in headless Chromium, Firefox, and WebKit.
- **`pnpm test:e2e`** runs the Playwright suites in `e2e/` on iPhone (WebKit), Pixel (Chromium), and desktop Chromium. They run against the `pnpm dev` already serving this checkout on port 3000, or start one for the run and stop it afterwards. They use Neon's `develop`, so run `pnpm db:seed` first. No test spends AI credit. Only the `email` project sends mail, to Resend's test inbox (`pnpm test:e2e --project=email`), and that still counts against the daily limit. The end-to-end suites never run in CI.

Each run writes its results under `test-results/`, which git ignores. That includes Vitest's single-file HTML report, and Playwright's traces and report, which `pnpm exec playwright show-report test-results/playwright/report` opens.
