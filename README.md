# Barb’s Table

Barb’s Table is a recipe catalog for our family's recipes. Anyone can browse and search it; approved members add recipes in three ways, all normalized to one recipe shape: photos of a written or printed recipe, a pasted recipe URL, or manual entry. Members request access, are invited by the admin, and sign in with a passkey or an emailed code.

## Stack

- [Next.js 16](https://nextjs.org/docs) (App Router, TypeScript) on Vercel, at [barbtable.com](https://barbtable.com), whose DNS is in Route 53
- [Neon](https://neon.com/docs) Postgres via the Vercel Marketplace, which also powers search, through [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (private store) for recipe images
- The [AI SDK](https://ai-sdk.dev/docs) through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) for reading recipe photos and pages into drafts
- [shadcn/ui](https://ui.shadcn.com/docs) on [Base UI](https://base-ui.com) primitives, with Tailwind CSS v4 tokens
- [Better Auth](https://www.better-auth.com/docs) with email codes and passkeys, sessions in Postgres
- [Resend](https://resend.com/docs) for email, through the Vercel Marketplace, sending as `Barb’s Table <recipes@mail.barbtable.com>`
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

Product policy (the limits on recipes, photos, and imports, which apply when content is written, the lifetimes, the import models, page size, and the time zone) lives in [`src/lib/settings.ts`](src/lib/settings.ts), each value beside its reason. `next.config.ts` checks the values against their safe ranges in [`src/lib/settings-schema.ts`](src/lib/settings-schema.ts), so a bad edit fails `pnpm dev`, `pnpm test`, and `pnpm build`.

The design reference at [localhost:3000/design](http://localhost:3000/design) shows every design token, UI primitive, and composition. It exists in development and on preview deployments only. Add primitives with `pnpm shadcn add <name>`, then run `pnpm format` and `pnpm exec eslint . --fix`.

| Script                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                    | Start the dev server                                            |
| `pnpm build`                  | Production build                                                |
| `pnpm lint`                   | Run every `lint:` script                                        |
| `pnpm lint:boundaries`        | Check the layer boundaries with dependency-cruiser              |
| `pnpm lint:code`              | ESLint                                                          |
| `pnpm lint:format`            | Check formatting                                                |
| `pnpm lint:migrations`        | Check the migration history for conflicts                       |
| `pnpm format`                 | Format with Prettier                                            |
| `pnpm typecheck`              | Generate route types, then run `tsc`                            |
| `pnpm test`                   | Run Vitest: repository tests on PGlite, components in happy-dom |
| `pnpm db:generate`            | Generate a migration from `src/infrastructure/db/schema.ts`     |
| `pnpm db:migrate`             | Apply migrations to the database in `DATABASE_URL_UNPOOLED`     |
| `pnpm db:bootstrap`           | Make the owner, the account at `ADMIN_EMAIL`, an admin          |
| `pnpm db:seed`                | Seed synthetic recipes and photos (refused in production)       |
| `pnpm db:reparse-ingredients` | Diff saved recipes against tidying and parsing; `--write` saves |
| `pnpm evaluate`               | Score import models on `scripts/evaluate/` (spends AI credit)   |

## Database

Local development uses the Neon branch `develop`, whose connection strings are Development-scoped variables in Vercel, so `vercel env pull` never points a local checkout at production. Its images live in a Blob store of its own, `recipe-hub-images-dev`, connected to Development only. Run `pnpm db:seed` to fill the branch and the store with the synthetic sample recipes and their photos, added by a "Sample contributor" member; it skips recipes already there but uploads any of their photos the store is missing, so running it again repopulates an emptied store. Recipes `develop` copied from production name production's photos, which that store does not hold, so they show without them. `pnpm db:bootstrap` makes the owner, the account at `ADMIN_EMAIL`, an admin, creating it if needed. Change the schema in `src/infrastructure/db/schema.ts`, run `pnpm db:generate --name <change>`, and commit the generated migration. Extensions, functions, and text search configurations go in a custom migration (`pnpm db:generate --custom --name <change>`) with a `--> statement-breakpoint` after every statement. Keep migrations backward compatible (add first, remove in a later deployment), because each deployment's build applies them before the new code goes live.

## Deployment

Vercel deploys `main` to production and every pull request to a preview URL. Each preview gets its own Neon branch, `preview/<git-branch>`, which the build migrates, bootstraps, and seeds before `next build` (`vercel.json`), and the Neon integration deletes it with the branch's last preview deployment. Vercel deletes preview deployments 7 days after they are made, except the ones it retains (the runbook's "Previews after a branch closes"). Production builds skip the seed. On a preview, sign in with an email code as `ADMIN_EMAIL`; passkeys made on production do not work there. Images live in a private Blob store shared by production and previews, under `dish/<environment>/` and `scan/<environment>/` (local development has its own store, as Database describes), and the app authenticates to it with Vercel's OIDC token. Removed images move to `trash/` and are deleted for good once they outlive the removed-image lifetime. After each recipe or import write, the deployment sweeps its own folders: it moves uploads nothing has named within the unused-upload lifetime to `trash/`, restores any removed image a recipe or draft names again, and deletes the trash past its lifetime. Production's sweep also deletes previews' images, stored or removed, past the expiring-image lifetime, whether or not their branch had a pull request. The settings file's `retention` group sets the three lifetimes. Vercel WAF rate-limit rules on `/search` and on posts to `/request-access` keep uncached searches from running up Neon's compute and the request form from being flooded. GitHub Actions runs lint, format, typecheck, and tests on pull requests and `main`. Every response carries a static Content Security Policy and security headers from `next.config.ts`.

## Accounts

Anyone can request access at `/request-access`. Admins review requests at `/admin`, where approving one creates a single-use invite link that expires after the settings file's invite lifetime, emailed or copied to send by text. Accepting an invite confirms an email address with a code and creates the account; members then sign in with a passkey or an emailed code, and add passkeys on `/account`. The account at `ADMIN_EMAIL` is the owner: every build's bootstrap step makes it an admin, creating it if needed, and no one can remove it or take its admin role. Changing `ADMIN_EMAIL` moves ownership to the account at the new address on the next build; the previous owner stays an admin until another admin removes that role. Admins can make other members admins, or remove a member, on `/admin`. A removed member comes back only by a new invite to their address, which creates a new account; the recipes they added stay credited to the removed account's name, and admins can still edit them.

## Imports

Members import a recipe at `/contribute` from a link or from photos of a written or printed recipe. A link's schema.org data is read when it is complete; otherwise, and for photos, a model reads the page or photos through the AI Gateway. Each import becomes a draft that the member reviews in the recipe form at `/contribute/imports/<id>` before saving. The settings file names the models and sets how long drafts are kept and how many imports a member can start a day; the Gateway's credit limit pauses imports when it is reached. `pnpm evaluate` reruns the model comparison on the public-domain cases in `scripts/evaluate/`.

## Runbook

**Logs.** In Vercel, open the project's Logs, choose Production, and filter by level. Vercel keeps runtime logs for one day and nothing alerts, so look soon after anything seems wrong. Each line is JSON with ids and codes, never emails or recipe text. Lines worth knowing: "Images swept" (each image sweep's counts), "Recipe images could not be removed" (an edit's or delete's photos that its background task could not remove after the response, left for a later sweep, as when a running sweep held the image lock too long), "Import failed" (warn when the model failed or credits ran out, error when unexpected), "Better Auth request failed", "Header session read failed", "Sign-in code email failed", and "Sign-in code request refused as automated" (BotID). Many failures inside a page still answer 200, so read the lines, not the status codes.

**The image sweep.** It runs after every recipe create, edit, or delete and every import, once the response is sent, in the deployment that took the write: production, a preview, or the dev server. After an edit or delete, the same background task first waits for the image lock and removes the photos the write let go that nothing else names ("Recipe images removed"), then sweeps without letting go of the lock. Each run writes one "Images swept" line with what it restored, deleted, removed, and expired: find it in Vercel's runtime logs (Logs, choose the deployment's environment, and search for the message) or in the dev server's output. "Image sweep skipped while another image move runs" means a sweep already running covers it, or an edit's or delete's task is removing photos and sweeps once it is done. "Image sweep failed" (error) leaves the work for the next write's sweep. To run one now, save any recipe, unchanged if you like.

**Getting a deleted recipe back.** Neon keeps a 7-day restore window and daily snapshots for 35 days; removed photos and scans stay in Blob's trash for the removed-image lifetime, which the settings file keeps past those snapshots.

1. In the Neon console, open Backup & restore for the production branch, `main`, choose a time before the delete (or a snapshot, with One-step restore), and confirm Restore. It replaces the branch's data in place, keeping the connection string, and saves the previous state as a backup branch (`main_old_<timestamp>`), so first note any recipes added after that time, and delete the backup branch once you are sure, since each branch past ten is billed.
2. Save any recipe to run the image sweep (above). It moves back every trashed image a restored recipe names, and its "Images swept" line lists them as restored.
3. Open the recipe: its photos show again.

Rehearse it on `develop`: delete a recipe with a photo on the dev server, restore `develop` in Neon to before the delete, save any recipe on the dev server, and reload the restored one.

**Previews after a branch closes.** GitHub deletes a merged pull request's branch, Vercel deletes preview deployments 7 days after they are made, and when a branch's last preview is gone the Neon integration deletes its Neon branch, `preview/<branch>`. Vercel retains some previews past that window: the newest deployments, a branch's latest preview while the branch is active, and any deployment with an alias, so a closed branch's preview and Neon branch can stay for weeks. To clear one by hand, list the branch's previews with `vercel list --environment preview -m githubCommitRef=<branch>` and delete each with `vercel remove <url> --yes` (or under Deployments in Vercel); deleting the last one deletes its Neon branch. Neon's plan includes ten branches before each extra one is billed. Production's image sweep deletes the branch's images past the expiring-image lifetime either way.

**Removing someone.** On `/admin`, "Remove member" signs them out everywhere, deletes their passkeys, and frees their address, revoking any open invite to it. Their recipes stay, under their name. To let them back in, invite their address again; accepting creates a new account. The owner's account, at `ADMIN_EMAIL`, cannot be removed.

**Imports paused.** Members see "Imports are paused" when the AI Gateway's credits run out or the monthly auto-reload cap is reached. Check the team's AI Gateway page in Vercel and add credits or wait for the next month.

**Rate limits and firewall.** Vercel WAF rules limit `/search` (100 requests a minute per IP) and posts to `/request-access` (5 per 10 minutes per IP). A third, "Log image cache bypasses", only logs requests to `/api/images/` that carry `_vercel_system`: the image route accepts that query parameter because Vercel's image optimizer adds it, so such a request skips the CDN cache. The firewall's traffic view shows blocked and logged requests.
