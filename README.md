# Recipe Hub

A recipe catalog for our family's recipes. Anyone can browse and search it; approved members add recipes in three ways, all normalized to one recipe shape: photos of a written or printed recipe, a pasted recipe URL, or manual entry. Members request access, are invited by the admin, and sign in with a passkey or an emailed code.

## Stack

- [Next.js 16](https://nextjs.org/docs) (App Router, TypeScript) on Vercel
- [Neon](https://neon.com/docs) Postgres via the Vercel Marketplace, which also powers search
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (private store) for recipe images
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) for parsing scans and URLs into recipes
- [shadcn/ui](https://ui.shadcn.com/docs) on [Base UI](https://base-ui.com) primitives, with Tailwind CSS v4 tokens
- Planned as features land: [Better Auth](https://www.better-auth.com/docs) with passkeys, [Drizzle ORM](https://orm.drizzle.team/docs/overview), the [AI SDK](https://ai-sdk.dev/docs), [Resend](https://resend.com/docs) for email

## Development

Requires Node 24, [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli).

```bash
pnpm install
vercel link       # once, connects this checkout to the Vercel project
vercel env pull   # writes .env.local; rerun when the AI Gateway OIDC token expires (12h)
pnpm dev
```

The design reference at [localhost:3000/design](http://localhost:3000/design) shows every design token, UI primitive, and composition. It exists in development and on preview deployments only. Add primitives with `pnpm shadcn add <name>`, then run `pnpm format` and `pnpm exec eslint . --fix`.

| Script             | Purpose                              |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | Start the dev server                 |
| `pnpm build`       | Production build                     |
| `pnpm lint`        | Run every `lint:` script             |
| `pnpm lint:code`   | ESLint                               |
| `pnpm lint:format` | Check formatting                     |
| `pnpm format`      | Format with Prettier                 |
| `pnpm typecheck`   | Generate route types, then run `tsc` |
| `pnpm test`        | Run Vitest                           |

## Deployment

Vercel deploys `main` to production and every pull request to a preview URL. GitHub Actions runs lint, format, typecheck, and tests on pull requests and `main`.
