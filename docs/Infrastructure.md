# Infrastructure

recipe-hub runs on Vercel, with its database on Neon and its images in Vercel Blob, all in US East (us-east-1). Each environment has its own database and image store. The one crossover is that previews show production's photos through its public image route ([Blob](#blob)).

## Environments

- **Production** serves barbtable.com from `main`.
- **Previews** deploy from every push to any other branch, with or without a pull request. A branch's previews share a Neon branch of their own, copied from production when the first one builds, and every preview uses the preview image store. Passkeys made on production don't work on a preview, so sign in there as the owner with an emailed code.
- **Local development** runs `pnpm dev` against the Neon branch `develop` and the development image store. It gets these through Development-scoped variables, so `vercel env pull` never points a checkout at production.

## Vercel

The Vercel project is `recipe-hub`, in the `jrichard-personal` team on the Pro plan. It deploys from GitHub and runs its database steps before each build ([Operations](Operations.md#builds)). barbtable.com is the production domain, and both www.barbtable.com and the project's vercel.app alias redirect to it. Every other deployment URL needs a Vercel login (Vercel Authentication). Skew Protection keeps a replaced deployment's Server Actions answering for a while after a new deployment goes live.

Public recipe reads are kept in Vercel's Runtime Cache. Every function instance shares it, it's billed per read and write, and each new deployment starts with it empty.

The firewall rate-limits three things per IP: searches, the filter counts the Recipes page fetches as its filters change, and posts to the access request form. It also logs, without blocking, requests to the image route that carry the image optimizer's query parameter, since those skip the CDN cache. The AI Bots managed ruleset stays on Allow. Deny would also block search crawlers and the fetchers people's AI assistants use, and robots.txt already asks training crawlers to stay out.

## Neon

The Neon project, `recipe-hub-db`, comes through Vercel's Marketplace integration. Its branches are `main` for production (protected), `develop` for local development (a child of `main`), and `preview/<git-branch>` for each Git branch with previews. The integration creates a preview's Neon branch with the Git branch's first preview and deletes it with the last. Each branch's compute suspends when it's idle. Neon's plan includes ten branches and bills for each one past that.

Outside production, the app and every build step refuse production's database, which a configuration variable on Preview and Development identifies by its endpoint. This matters because a preview the integration failed to give its own branch would fall back to the Preview variables, which hold production's connection strings.

## Blob

Images live in three private stores, each connected only to its own environment: `recipe-hub-images-prod`, `recipe-hub-images-preview`, and `recipe-hub-images-dev`. Every preview writes only under its own branch's folders in the preview store. The app reaches its store with Vercel's OIDC token, so it holds no store token. Photos upload from the browser straight to the store, under a grant the app issues. Every image (dish photos and scans alike) is served publicly through the app's image route, which the CDN caches.

A preview's database names production's photos, which the preview fetches from production's public image route and serves through its own. That way, no preview holds production's store credentials. Development only serves its own photos and the seed's, so recipes `develop` copied from production show up without theirs. The seed's sample photos sit in the preview and development stores, outside every deployment's folders.

A removed image moves to a trash folder in the same store, and is only deleted for good after Neon's snapshots have expired, so restoring the database can bring it back.

## DNS and mail

Route 53 holds the barbtable.com zone. The apex and www point at Vercel. The apex sends no mail (it has a null MX and an SPF record that allows no sender), and its TXT record also holds Google Search Console's verification, which has to stay for the console to keep access.

Mail goes out through Resend, installed from Vercel's Marketplace as `recipe-hub-email`, from the subdomain mail.barbtable.com, which holds Resend's sending records. DMARC rejects unauthenticated mail and asks for no reports. Nothing receives mail: a reply to a sign-in code or an access request notice reaches no one, and a reply to an invite goes to the admin who sent it. Every environment sends real mail on Resend's free plan, so they all share its daily limit.

The site's canonical links, its metadata, and production's email links take their host from Vercel's production domain, so barbtable.com is canonical without any configuration. Passkeys are bound to that domain and sessions to the host, so changing the domain means signing in again and registering new passkeys.

## AI Gateway

Imports read photos of a recipe, and linked pages without complete structured recipe data, through the Vercel AI Gateway. The app reaches the Gateway with Vercel's OIDC token, so there's no provider key. Each call asks for zero data retention, and labels the member by id (never by email) in the Gateway's usage reports. Every environment spends the team's Gateway credits, and when they run out, imports pause until they're topped up.

A linked page is fetched under a User-Agent that names the site. Sites behind bot walls, like Allrecipes, refuse it, and the import reports them as sites that don't support importing.

## GitHub

The repository, `jaARke/recipe-hub`, runs three workflows: CI, Preview cleanup, and the wiki publish. Each one pins its actions to a full commit SHA. A ruleset on `main` only admits changes by pull request, and Dependabot keeps the packages and actions current, with its alerts and security updates turned on. [Operations](Operations.md#scheduled-and-triggered-jobs) covers each of these.

## Secrets

These are names only; each value stays where it's held.

- **Vercel, Production and Preview:** `BETTER_AUTH_SECRET`, a Secret in each; `CRON_SECRET`, in Production only; and the Neon integration's database URLs, `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct), along with others of its own that the app doesn't read.
- **Vercel, Development:** its own readable `BETTER_AUTH_SECRET`, and `develop`'s `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- **Vercel, every environment:** `RESEND_API_KEY`, which Resend's integration manages and keeps readable.
- **GitHub repository:** `VERCEL_TOKEN`, a Vercel token scoped to this project, and `PREVIEW_BLOB_TOKEN`, the preview store's read-write token. Each one belongs to one of Preview cleanup's two jobs.

Everything else is plain configuration: `ADMIN_EMAIL` (the owner's address), the mail domain, each environment's store, and production's Neon endpoint.
