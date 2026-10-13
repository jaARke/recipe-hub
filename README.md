# Recipe Hub

A recipe catalog for our family's recipes. Anyone can browse and search it; approved members add recipes in three ways, all normalized to one recipe shape: photos of a written or printed recipe, a pasted recipe URL, or manual entry. Members request access, are invited by the admin, and sign in with a passkey or an emailed code.

## Stack

- [Next.js 16](https://nextjs.org/docs) (App Router, TypeScript) on Vercel
- [Neon](https://neon.com/docs) Postgres via the Vercel Marketplace, which also powers search, through [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (private store) for recipe images
- The [AI SDK](https://ai-sdk.dev/docs) through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) for reading recipe photos and pages into drafts
- [shadcn/ui](https://ui.shadcn.com/docs) on [Base UI](https://base-ui.com) primitives, with Tailwind CSS v4 tokens
- [Better Auth](https://www.better-auth.com/docs) with email codes and passkeys, sessions in Postgres
- [Resend](https://resend.com/docs) for email, through the Vercel Marketplace, sending from `recipes.jakerichard.tech`
- [Vercel BotID](https://vercel.com/docs/botid) on the access request form and sign-in code requests

## Development

Requires Node 24, [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli).

```bash
pnpm install
vercel link       # once, connects this checkout to the Vercel project
vercel env pull   # writes .env.local; the Blob and AI SDKs renew its 12-hour OIDC token with your CLI login
pnpm db:migrate && pnpm db:bootstrap && pnpm db:seed   # once, and after pulling new migrations
pnpm dev
```

Sign in at [localhost:3000/sign-in](http://localhost:3000/sign-in) with a code emailed to `ADMIN_EMAIL`, the account `pnpm db:bootstrap` makes an admin. Development sends real email through Resend.

The design reference at [localhost:3000/design](http://localhost:3000/design) shows every design token, UI primitive, and composition. It exists in development and on preview deployments only. Add primitives with `pnpm shadcn add <name>`, then run `pnpm format` and `pnpm exec eslint . --fix`.

| Script                 | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `pnpm dev`             | Start the dev server                                            |
| `pnpm build`           | Production build                                                |
| `pnpm lint`            | Run every `lint:` script                                        |
| `pnpm lint:boundaries` | Check the layer boundaries with dependency-cruiser              |
| `pnpm lint:code`       | ESLint                                                          |
| `pnpm lint:format`     | Check formatting                                                |
| `pnpm lint:migrations` | Check the migration history for conflicts                       |
| `pnpm format`          | Format with Prettier                                            |
| `pnpm typecheck`       | Generate route types, then run `tsc`                            |
| `pnpm test`            | Run Vitest, including repository tests against in-memory PGlite |
| `pnpm db:generate`     | Generate a migration from `src/infrastructure/db/schema.ts`     |
| `pnpm db:migrate`      | Apply migrations to the database in `DATABASE_URL_UNPOOLED`     |
| `pnpm db:bootstrap`    | Make `ADMIN_EMAIL` an admin when the database has none          |
| `pnpm db:seed`         | Seed synthetic recipes and photos (refused in production)       |
| `pnpm sweep-images`    | Sweep unused and long-removed images in `development`           |
| `pnpm evaluate`        | Score import models on `scripts/evaluate/` (spends AI credit)   |

## Database

Local development uses the Neon branch `develop`, whose connection strings are Development-scoped variables in Vercel, so `vercel env pull` never points a local checkout at production. Run `pnpm db:seed` to fill it with the synthetic sample recipes and their photos, added by a "Sample contributor" member; it skips anything already there. `pnpm db:bootstrap` makes the account at `ADMIN_EMAIL` an admin, creating it if needed, whenever the database has no admin. Change the schema in `src/infrastructure/db/schema.ts`, run `pnpm db:generate --name <change>`, and commit the generated migration. Extensions, functions, and text search configurations go in a custom migration (`pnpm db:generate --custom --name <change>`) with a `--> statement-breakpoint` after every statement. Keep migrations backward compatible (add first, remove in a later deployment), because each deployment's build applies them before the new code goes live.

## Deployment

Vercel deploys `main` to production and every pull request to a preview URL. Each preview gets its own Neon branch, `preview/<git-branch>`, which the build migrates, bootstraps, and seeds before `next build` (`vercel.json`), and a workflow deletes it when the pull request closes. Production builds skip the seed. On a preview, sign in with an email code as `ADMIN_EMAIL`; passkeys made on production do not work there. Images live in a private Blob store shared by production and previews, under `dish/<environment>/` and `scan/<environment>/` (local development uses its own store), and the app authenticates to it with Vercel's OIDC token. Removed images move to `trash/` for 40 days; a daily Vercel cron sweeps unused uploads and restores any removed image a recipe names again, and when a pull request closes, the cleanup workflow has its preview delete that branch's images. Vercel WAF rate-limit rules on `/search` and on posts to `/request-access` keep uncached searches from running up Neon's compute and the request form from being flooded. GitHub Actions runs lint, format, typecheck, and tests on pull requests and `main`. Every response carries a static Content Security Policy and security headers from `next.config.ts`.

## Accounts

Anyone can request access at `/request-access`. Admins review requests at `/admin`, where approving one creates a single-use invite link that lasts 7 days, emailed or copied to send by text. Accepting an invite confirms an email address with a code and creates the account; members then sign in with a passkey or an emailed code, and add passkeys on `/account`. The first admin is the account at `ADMIN_EMAIL`, which the build's bootstrap step creates when no admin exists, and admins can make other members admins, or remove a member, on `/admin`.

## Imports

Members import a recipe at `/contribute` from a link or from photos of a written or printed recipe. A link's schema.org data is read when it is complete; otherwise, and for photos, Claude Sonnet reads the page or photos through the AI Gateway. Each import becomes a draft that the member reviews in the recipe form at `/contribute/imports/<id>` before saving; drafts are kept for 7 days. Members can start 50 imports a day, and the Gateway's credit limit pauses imports when it is reached. `pnpm evaluate` reruns the model comparison on the public-domain cases in `scripts/evaluate/`.

## Runbook

**Logs.** In Vercel, open the project's Logs, choose Production, and filter by level. Vercel keeps runtime logs for one day and nothing alerts, so look soon after anything seems wrong. Each line is JSON with ids and codes, never emails or recipe text. Lines worth knowing: "Images swept" (the daily sweep's counts), "Import failed" (warn when the model failed or credits ran out, error when unexpected), "Better Auth request failed", "Header session read failed", "Sign-in code email failed", and "Sign-in code request refused as automated" (BotID). Many failures inside a page still answer 200, so read the lines, not the status codes.

**The daily sweep.** Vercel's cron calls `/api/cron/sweep-images` at 09:00 UTC on production with `CRON_SECRET`. To run it now, run `vercel crons run /api/cron/sweep-images` from this checkout, or use Settings, Cron Jobs, Run, then look for its "Images swept" line. A run is never retried, so a missing line means it failed or never reached the function. Locally, `pnpm sweep-images` sweeps `development` (it refuses anywhere else). To rotate the secret: `openssl rand -base64 32 | tr -d '\n' | vercel env add CRON_SECRET production --sensitive` after removing the old one, then redeploy production.

**Getting a deleted recipe back.** Neon keeps a 7-day restore window and daily snapshots for 35 days; removed photos and scans stay in Blob's trash for 40 days.

1. In the Neon console, open Backup & restore for the production branch, `main`, choose a time before the delete (or a snapshot, with One-step restore), and confirm Restore. It replaces the branch's data in place, keeping the connection string, and saves the previous state as a backup branch (`main_old_<timestamp>`), so first note any recipes added after that time, and delete the backup branch once you are sure, since each branch past ten is billed.
2. Run the sweep (above). It moves back every trashed image a restored recipe names, and its "Images swept" line lists them as restored.
3. Open the recipe: its photos show again.

Rehearse it on `develop`: delete a recipe with a photo on the dev server, restore `develop` in Neon to before the delete, run `pnpm sweep-images`, and reload the recipe.

**A closed pull request.** The cleanup workflow deletes its Neon branch, `preview/<branch>`, and asks its newest successful preview to delete that branch's images, past Vercel Authentication through the GitHub Actions Trusted Source. If either job fails (Actions, Preview branch cleanup), rerun it from there; a 401 from the image job means the preview refused the workflow's token, so read that preview's logs for the warning and check the run came from `main` on `pull_request_target`. A branch pushed without a pull request is never cleaned; delete its Neon branch in Neon, and its folders under Storage, `recipe-hub-images`.

**Removing someone.** On `/admin`, "Remove member" signs them out everywhere, deletes their passkeys, and stops codes to their address. Their recipes stay, under their name. Re-inviting that address does not work.

**Imports paused.** Members see "Imports are paused" when the AI Gateway's credits run out or the monthly auto-reload cap is reached. Check the team's AI Gateway page in Vercel and add credits or wait for the next month.

**Rate limits and firewall.** Vercel WAF rules limit `/search` (100 requests a minute per IP) and posts to `/request-access` (5 per 10 minutes per IP). The firewall's traffic view shows blocked requests.
