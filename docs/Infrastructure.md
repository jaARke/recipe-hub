# Infrastructure

Barb’s Table runs on Vercel at barbtable.com, with its database on Neon and its images in Vercel Blob, all in US East (us-east-1). Each environment has a database and an image store of its own, and no environment reaches another's data.

## Environments

- **Production** serves barbtable.com from `main`.
- **Previews.** Every push to any other branch deploys a preview, with or without a pull request. A branch's previews share a Neon branch of their own, copied from production when the first one builds, and every preview uses the preview image store. Passkeys made on production don't work on a preview, so sign in there with an emailed code as the owner.
- **Local development** is `pnpm dev` on the Neon branch `develop` and the development image store, through Development-scoped variables, so `vercel env pull` never points a checkout at production.

## Vercel

The project `recipe-hub`, in the team `jrichard-personal` on the Pro plan, deploys from GitHub, with its database steps ahead of each build ([Operations](Operations.md#builds)). barbtable.com is the production domain, and www.barbtable.com and the project's vercel.app alias redirect to it. Every other deployment URL needs a Vercel login (Vercel Authentication). Skew Protection keeps a replaced deployment's Server Actions answering for a while after a new deployment goes live. Public recipe reads are kept in Vercel's Runtime Cache, which every function instance shares and which is billed per read and write; a new deployment starts with it empty.

The firewall rate-limits searches and posts to the access-request form per IP, and logs, without blocking, requests to the image route that carry the image optimizer's query parameter, since those skip the CDN cache. The AI Bots managed ruleset stays on Allow: Deny would also block search crawlers and the fetchers people's assistants use, and robots.txt already asks training crawlers out.

## Neon

The Neon project `recipe-hub-db` comes through Vercel's Marketplace integration. Its branches are `main` for production (protected), `develop` for local development (a child of `main`), and `preview/<git-branch>` for each branch with previews, which the integration creates with the branch's first preview and deletes with its last. Each branch's compute suspends when idle. Neon's plan includes ten branches and bills each one past them.

Outside production, the app and every build step refuse production's database, which a configuration variable on Preview and Development names by its endpoint. Without that check, a preview the integration failed to give its own branch would fall back to the Preview variables, which hold production's connection strings.

## Blob

Images live in three private stores, each connected to its own environment alone: `recipe-hub-images-prod`, `recipe-hub-images-preview` (every preview writes only under its own branch's folders), and `recipe-hub-images-dev`. The app reaches its store with Vercel's OIDC token, so it holds no store token. Photos upload from the browser straight to the store under a grant the app issues, and every image, dish photos and scans alike, is served publicly through the app's image route, which the CDN caches.

A preview's database names production's photos, which the preview fetches from production's public image route and serves through its own, so no preview holds production's store credentials. Development serves only its own photos and the seed's, so recipes `develop` copied from production show without theirs. The seed's sample photos sit in the preview and development stores, outside every deployment's folders. A removed image moves to a trash folder in the same store and is deleted for good only after Neon's snapshots have expired, so restoring the database can bring it back.

## DNS and mail

The barbtable.com zone is in Route 53, in the owner's personal AWS account. The apex and www point at Vercel, and the apex sends no mail (a null MX and an SPF record that allows no sender). Mail goes out through Resend, installed from Vercel's Marketplace as `recipe-hub-email`, from the subdomain mail.barbtable.com, which holds Resend's sending records. DMARC rejects unauthenticated mail and asks for no reports. Nothing receives mail: a reply to a sign-in code or an access-request notice reaches no one, and an invite's reply goes to the admin who sent it. Every environment sends real mail on Resend's free plan, so all of them share its daily limit.

The site's canonical links, its metadata, and production's email links take their host from Vercel's production domain, so barbtable.com is canonical with no configuration. Passkeys are bound to that domain and sessions to the host, so a domain change means signing in again and registering new passkeys.

## AI Gateway

Imports read photos of a written recipe, and linked pages without complete structured recipe data, through the Vercel AI Gateway, which the app reaches with Vercel's OIDC token, so no provider key exists. Each call asks for zero data retention and labels the member by id, never by email, in the Gateway's usage reports. Every environment spends the team's Gateway credits, and when they run out, imports pause until they are topped up. A linked page is fetched under a User-Agent that names the site, and sites behind bot walls, Allrecipes among them, refuse it, which the import reports as a site that doesn't support importing.

## GitHub

The repository `jaARke/recipe-hub` runs three workflows, each pinning its actions to a full commit SHA: CI, Preview cleanup, and the wiki publish ([Operations](Operations.md#scheduled-and-triggered-jobs)). `main` carries no branch protection or rulesets.

## Secrets

Names only; each value stays where it is held.

- **Vercel, Production and Preview:** `BETTER_AUTH_SECRET`, a Secret in each; `CRON_SECRET`, in Production only; and the Neon integration's database URLs, `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct), among others of its own the app doesn't read.
- **Vercel, Development:** a readable `BETTER_AUTH_SECRET` of its own, and `develop`'s `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- **Vercel, every environment:** `RESEND_API_KEY`, which Resend's integration manages and keeps readable.
- **Vercel project:** a Protection Bypass for Automation secret, which nothing uses.
- **GitHub repository:** `VERCEL_TOKEN`, a Vercel token scoped to this project, and `PREVIEW_BLOB_TOKEN`, the preview store's read-write token, one for each of Preview cleanup's two jobs.

The other variables are plain configuration: `ADMIN_EMAIL` (the owner's address), the mail domain, each environment's store, and production's Neon endpoint.
