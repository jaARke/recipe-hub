# Recipe Hub

A private site for browsing and searching our family's recipes. Recipes come in three ways, all normalized to one recipe shape: photos of a written or printed recipe, a pasted recipe URL, or manual entry. Access is limited to family members through Facebook login and an allowlist.

## Stack

- [Next.js 16](https://nextjs.org/docs) (App Router, TypeScript) on Vercel
- [Neon](https://neon.com/docs) Postgres via the Vercel Marketplace, which also powers search
- [Vercel Blob](https://vercel.com/docs/vercel-blob) (private store) for recipe images
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) for parsing scans and URLs into recipes
- Planned as features land: [Better Auth](https://www.better-auth.com/docs) with Facebook, [Drizzle ORM](https://orm.drizzle.team/docs/overview), the [AI SDK](https://ai-sdk.dev/docs)

## Development

Requires Node 24, [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli).

```bash
pnpm install
vercel link       # once, connects this checkout to the Vercel project
vercel env pull   # writes .env.local; rerun when the AI Gateway OIDC token expires (12h)
pnpm dev
```

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
