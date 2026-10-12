# Recipe Hub

A recipe catalog for our family's recipes. Anyone can browse and search it; approved members add recipes in three ways, all normalized to one recipe shape: photos of a written or printed recipe, a pasted recipe URL, or manual entry. Members request access, are invited by the admin, and sign in with a passkey or an emailed code.

## Stack

- [Next.js 16](https://nextjs.org/docs) (App Router, TypeScript) on Vercel
- [Neon](https://neon.com/docs) Postgres via the Vercel Marketplace, which also powers search, through [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (private store) for recipe images
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) for parsing scans and URLs into recipes
- [shadcn/ui](https://ui.shadcn.com/docs) on [Base UI](https://base-ui.com) primitives, with Tailwind CSS v4 tokens
- [Better Auth](https://www.better-auth.com/docs) with email codes and passkeys, sessions in Postgres
- [Resend](https://resend.com/docs) for email, through the Vercel Marketplace, sending from `recipes.jakerichard.tech`
- [Vercel BotID](https://vercel.com/docs/botid) on the access request form
- Planned as features land: the [AI SDK](https://ai-sdk.dev/docs)

## Development

Requires Node 24, [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli).

```bash
pnpm install
vercel link       # once, connects this checkout to the Vercel project
vercel env pull   # writes .env.local; rerun when the AI Gateway OIDC token expires (12h)
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

## Database

Local development uses the Neon branch `develop`, whose connection strings are Development-scoped variables in Vercel, so `vercel env pull` never points a local checkout at production. Run `pnpm db:seed` to fill it with the synthetic sample recipes and their photos, added by a "Sample contributor" member; it skips anything already there. `pnpm db:bootstrap` makes the account at `ADMIN_EMAIL` an admin, creating it if needed, whenever the database has no admin. Change the schema in `src/infrastructure/db/schema.ts`, run `pnpm db:generate --name <change>`, and commit the generated migration. Extensions, functions, and text search configurations go in a custom migration (`pnpm db:generate --custom --name <change>`) with a `--> statement-breakpoint` after every statement. Keep migrations backward compatible (add first, remove in a later deployment), because each deployment's build applies them before the new code goes live.

## Deployment

Vercel deploys `main` to production and every pull request to a preview URL. Each preview gets its own Neon branch, `preview/<git-branch>`, which the build migrates, bootstraps, and seeds before `next build` (`vercel.json`), and a workflow deletes it when the pull request closes. Production builds skip the seed. On a preview, sign in with an email code as `ADMIN_EMAIL`; passkeys made on production do not work there. Images live in one private Blob store shared by every environment, under `dish/<environment>/` and `scan/<environment>/`, and the app authenticates to it with Vercel's OIDC token. Vercel WAF rate-limit rules on `/search` and on posts to `/request-access` keep uncached searches from running up Neon's compute and the request form from being flooded. GitHub Actions runs lint, format, typecheck, and tests on pull requests and `main`.

## Accounts

Anyone can request access at `/request-access`. Admins review requests at `/admin`, where approving one creates a single-use invite link that lasts 7 days, emailed or copied to send by text. Accepting an invite confirms an email address with a code and creates the account; members then sign in with a passkey or an emailed code, and add passkeys on `/account`. The first admin is the account at `ADMIN_EMAIL`, which the build's bootstrap step creates when no admin exists.
