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

## Documentation

[`docs/`](docs/README.md) describes the [architecture](docs/Architecture.md), the [infrastructure](docs/Infrastructure.md) behind each environment, and [operations](docs/Operations.md): the build steps and scheduled jobs, rotating secrets, restoring the database, and running the tests. The repository's wiki publishes the same pages.

## Development

Requires Node 24, [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli).

```bash
pnpm install
pnpm exec playwright install --only-shell chromium firefox webkit   # once, the browsers pnpm test:unit and pnpm test:e2e run in
vercel link       # once, connects this checkout to the Vercel project
vercel env pull   # writes .env.local; the Blob and AI SDKs renew its 12-hour OIDC token with your CLI login
pnpm db:migrate && pnpm db:bootstrap && pnpm db:seed   # once, and after pulling new migrations
pnpm dev
```

Sign in at [localhost:3000/sign-in](http://localhost:3000/sign-in) with a code emailed to `ADMIN_EMAIL`, the account `pnpm db:bootstrap` makes an admin. Development sends real email through Resend.

pnpm applies `patches/next@16.4.2.patch` to Next's `"use cache"` wrapper and its dev server's manifest writes as it installs; the patch's header says what each part fixes and when to remove it. Changing Next's version fails `pnpm install` until the patch is re-made against the new version or removed, and re-making it with `pnpm patch` drops the header, so carry that over. Dependabot leaves Next's packages alone for the same reason, so its ignore of them in `.github/dependabot.yml` goes when the patch does.

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
| `pnpm test`                   | Run every `test:` script, one after another                     |
| `pnpm test:e2e`               | Run the end-to-end suites on `pnpm dev` (sends no email)        |
| `pnpm test:unit`              | Run Vitest: repository tests on PGlite, components in browsers  |
| `pnpm db:generate`            | Generate a migration from `src/infrastructure/db/schema.ts`     |
| `pnpm db:migrate`             | Apply migrations to the database in `DATABASE_URL_UNPOOLED`     |
| `pnpm db:bootstrap`           | Make the owner, the account at `ADMIN_EMAIL`, an admin          |
| `pnpm db:seed`                | Seed synthetic recipes and photos (refused in production)       |
| `pnpm db:reparse-ingredients` | Diff saved recipes against tidying and parsing; `--write` saves |
| `pnpm evaluate`               | Score import models on `scripts/evaluate/` (spends AI credit)   |
