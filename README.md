# recipe-hub

A platform for sharing and browsing recipes. Anyone can browse and search, and members add recipes from a photo of a written or printed recipe, from a link, or by hand. AI turns photos and pages into drafts, so a member only has to review the result. Membership is by invitation from an admin (anyone can request access), and members sign in with a passkey or an emailed code.

A live deployment runs at [barbtable.com](https://barbtable.com).

## Stack

- [Next.js 16](https://nextjs.org/docs) (App Router, TypeScript) on Vercel, with DNS in Route 53
- [Neon](https://neon.com/docs) Postgres (through the Vercel Marketplace) for data and search, with [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (a private store) for recipe images
- The [AI SDK](https://ai-sdk.dev/docs) through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), for reading recipe photos and pages into drafts
- [shadcn/ui](https://ui.shadcn.com/docs) on [Base UI](https://base-ui.com) primitives, with Tailwind CSS v4 tokens
- [Better Auth](https://www.better-auth.com/docs) with emailed codes and passkeys, and sessions in Postgres
- [Resend](https://resend.com/docs) for email through the Vercel Marketplace, sending from the deployment's mail subdomain
- [Vercel BotID](https://vercel.com/docs/botid) on the access request form and sign-in code requests

## Documentation

[`docs/`](docs/README.md) covers the [architecture](docs/Architecture.md), the [infrastructure](docs/Infrastructure.md) behind each environment, and [operations](docs/Operations.md) (builds, scheduled jobs, rotating secrets, restoring the database, and running the tests). The repository's wiki publishes the same pages.

## Development

You'll need Node 24, [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli). Development runs on the Vercel project's services (its development database and image store, email, and the AI Gateway), so the setup needs a Vercel login with access to the project.

1. Install the dependencies, and the browsers that `pnpm test:unit` and `pnpm test:e2e` run in:

   ```bash
   pnpm install
   pnpm exec playwright install --only-shell chromium firefox webkit
   ```

2. Link the checkout to the Vercel project and pull its development variables into `.env.local`. The Blob and AI SDKs renew the 12-hour OIDC token in that file with your Vercel CLI login.

   ```bash
   vercel link
   vercel env pull
   ```

3. Set up the database. Run this again after pulling new migrations.

   ```bash
   pnpm db:migrate && pnpm db:bootstrap && pnpm db:seed
   ```

4. Start the dev server with `pnpm dev`, and sign in at [localhost:3000/sign-in](http://localhost:3000/sign-in) with a code emailed to `ADMIN_EMAIL` (the account `pnpm db:bootstrap` makes an admin). Development sends real email through Resend.

### Next.js patch

pnpm applies `patches/next@16.4.2.patch` as it installs. The patch fixes two bugs in Next: one in the `"use cache"` wrapper, and one in how the dev server writes its manifest. Its header explains each fix and when it can be removed.

The patch only applies to Next 16.4.2, so changing Next's version makes `pnpm install` fail until the patch is re-made for the new version or removed. Re-making it with `pnpm patch` drops the header, so carry that over. For the same reason, Dependabot leaves Next's packages alone, and its ignore rule for them in `.github/dependabot.yml` can go when the patch does.

### Design reference

The design reference at [localhost:3000/design](http://localhost:3000/design) shows every design token, UI primitive, and composition. It's only available in development and on preview deployments. To add a primitive, run `pnpm shadcn add <name>`, then `pnpm format` and `pnpm exec eslint . --fix`.

### Scripts

| Script                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                    | Start the dev server                                            |
| `pnpm build`                  | Build for production                                            |
| `pnpm lint`                   | Run every `lint:` script                                        |
| `pnpm lint:boundaries`        | Check the layer boundaries with dependency-cruiser              |
| `pnpm lint:code`              | Run ESLint                                                      |
| `pnpm lint:format`            | Check formatting                                                |
| `pnpm lint:migrations`        | Check the migration history for conflicts                       |
| `pnpm format`                 | Format with Prettier                                            |
| `pnpm typecheck`              | Generate route types, then run `tsc`                            |
| `pnpm test`                   | Run every `test:` script, one after another                     |
| `pnpm test:e2e`               | Run the end-to-end suites against `pnpm dev` (sends no email)   |
| `pnpm test:unit`              | Run Vitest: repository tests on PGlite, components in browsers  |
| `pnpm db:generate`            | Generate a migration from `src/infrastructure/db/schema.ts`     |
| `pnpm db:migrate`             | Apply migrations to the database in `DATABASE_URL_UNPOOLED`     |
| `pnpm db:bootstrap`           | Make the account at `ADMIN_EMAIL` (the owner) an admin          |
| `pnpm db:seed`                | Seed synthetic recipes and photos (refused in production)       |
| `pnpm db:reparse-ingredients` | Compare saved recipes with tidying and parsing; `--write` saves |
| `pnpm evaluate`               | Score import models on `scripts/evaluate/` (spends AI credit)   |

## Contributing

recipe-hub isn't taking contributions; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The code is under the [MIT License](LICENSE). The license doesn't cover the brand assets listed in [`assets/brand/SOURCES.md`](assets/brand/SOURCES.md) (the mascot, the wordmark, and the icons and images made from them), which aren't for reuse. The fonts bundled in [`assets/fonts/`](assets/fonts) keep their own SIL Open Font License, and each one's OFL file sits beside it.
