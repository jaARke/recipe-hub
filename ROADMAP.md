# Recipe Hub Roadmap

This file carries the plan, the architecture, and the owner's guidance for Recipe Hub. Every session reads it in full before starting and updates it before finishing (status, decision log, deferred items). When the code and this file disagree, raise it with the owner instead of silently picking one.

## 1. Product

Recipe Hub is a recipe catalog for the owner's family: anyone can browse and search it, and approved members contribute recipes.

- **Access:** browsing and search are public, so members can share a recipe link with anyone. Contributing (adding and editing recipes) and every AI feature are limited to approved members. People request access; the admin approves and sends an invite, and members sign in with a passkey, or with an emailed one-time code where their device cannot hold one. The family scope is an access rule only: the site reads as a general-purpose recipe catalog (section 6.1).
- **Browse:** a recipe list and detail pages that are pleasant to read while cooking.
- **Search:** rich search across titles, ingredients, instructions, tags, and the person or place a recipe comes from, with filters.
- **Contribute:** three entry modes that all funnel into one normalized recipe shape:
  1. Photos of a written or printed recipe, parsed by AI.
  2. A pasted URL, parsed from the page's structured data first and by AI for the rest.
  3. Manual entry.

Contributors number in the tens, readers in the dozens to hundreds (anyone a member shares a link with), and the catalog hundreds to low thousands of recipes. Small does not mean ad hoc: the architecture is sound and canonical so the project can grow.

## 2. Guiding principles

The owner's guidance. Every session applies it, and the orchestrator checks every delegate's work against it.

1. **Small, flexible, extensible.** Build the smallest thing that solves the stated problem, in a shape that can grow. No speculative features, options, abstractions, or tooling without a real consumer.
2. **Industry standards first.** Ground decisions in current, industry-standard practice, OOP principles, and established design patterns. Verify library and platform behavior against current documentation (for Next.js, the docs bundled in `node_modules/next/dist/docs/`), never memory.
3. **Maintainability is the priority.** Prefer clarity over cleverness and explicit over implicit. There is one way to do each thing, and code that does the same thing looks the same.
4. **Think in layers.** For every layer, know what it is responsible for, how it exposes that to other layers, and what it guarantees them, so each layer can be reasoned about without reading its internals. Express the separation structurally: directories, files, and module boundaries mirror the layers, and tooling enforces the boundaries.
5. **Consistent and deliberate UI.** Built on a component library (shadcn/ui) with a tuned design language. Every screen uses the same tokens, primitives, and patterns, and nothing is styled ad hoc.
6. **Accessible by default.** WCAG 2.2 AA is the baseline for every UI change, not a final pass.
7. **Private where it matters.** Published recipes and dish photos are public; original scans, contact details, access requests, and member data stay private. Family data never enters the repository, and secrets live only in Vercel environment variables.

## 3. How sessions work

- **The main session is the orchestrator.** It owns high-level decisions, architectural forks, sequencing, and validating that delegated work matches this file. It delegates exploration, research, implementation, and test runs to subagents and keeps its own context for synthesis and review.
- **Delegate with clear ownership.** Give each subagent a disjoint set of files, the relevant sections of this file, and acceptance criteria. Subagents implement and report; they do not make architectural decisions. The orchestrator reviews every subagent's diff against sections 2 and 4 before integrating it.
- **Forks go to the owner.** Choices that shape architecture, scope, or a keep or drop decision are presented with a recommendation and its cost, batched together. Each session below lists the forks it is expected to resolve.
- **Session start:** read this file and `AGENTS.md`, review `git log` and the working tree for changes since the last session, and confirm scope with the owner.
- **Session end (definition of done):**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
  - Substantial changes get an external Codex review, and its findings are addressed.
  - The change is verified on its Vercel preview deployment.
  - This file is updated: session status, decision log, deferred items, and any guidance that changed.
  - Work lands through a pull request from a session branch (CI plus preview deployment) and merges with the owner's go-ahead.
- **Stay focused.** If a session's scope starts to sprawl, finish the current slice, record the remainder here, and stop. Prefer a clean handoff over a crowded context.

## 4. Architecture

### 4.1 Layers

Recipe Hub is one Next.js project organized as a layered, ports-and-adapters architecture. Dependencies point inward: presentation depends on application, application depends on domain, and infrastructure implements the application's ports.

| Layer | Location | Responsible for | Exposes | Guarantees |
| --- | --- | --- | --- | --- |
| Domain | `src/domain/` | The recipe and member model: entities, value objects, invariants, Zod schemas, domain errors | Types, schemas, pure functions | Pure and deterministic: no I/O, no framework imports, no environment access. A value that passes a domain schema is valid everywhere. |
| Application | `src/application/` | Use cases (browse, search, create, update, import, request and grant access), authorization, orchestration across ports | Service classes with intention-revealing methods; port interfaces in `src/application/ports/` | Server-only. Each use case declares who may call it: recipe reads, search, and access requests are open to anonymous visitors and return public DTOs (no contact details or provider IDs); scans and member data require a member; recipe writes and AI calls require an approved member; reviewing requests and managing members require an admin. Inputs are validated, and outputs are serializable DTOs. |
| Infrastructure | `src/infrastructure/` | Adapters to the outside world: Postgres through Drizzle, Vercel Blob, the AI Gateway, web fetching, Better Auth, the email sender | Classes implementing application ports | Translates external data into domain types at the boundary and hides vendor types and errors behind port contracts. |
| Composition | `src/composition/` | The composition root: constructs adapters and injects them into application services | Factories that return ready services | The only module that knows which adapter backs which port. |
| Presentation | `src/app/`, `src/components/` | Routes, layouts, pages, Server Actions, Route Handlers, UI components | Pages and components | Thin: parses input, calls one application service, renders the result. No business rules, SQL, or vendor SDKs. |
| Shared | `src/lib/` | Cross-cutting utilities: validated environment, logger, small helpers | Functions | Depends on no other layer. |

- **The application layer is the Data Access Layer** that the Next.js data security guide recommends: server-only, deciding for every read and write what the actor (an anonymous visitor or a member) may see or do, and returning minimal DTOs to the render context.
- **`src/components/ui/`** holds the shadcn primitives, which are adjusted only through tokens and variants. Feature components in `src/components/<feature>/` compose primitives and receive data as props. They never fetch data or call services.
- **Test kits** live in a `testing/` directory beside the layer they serve (in-memory port fakes in `src/application/testing/`, a migrated PGlite database in `src/infrastructure/db/testing/`). Only tests import them.
- **Synthetic samples** live in `src/domain/recipe/samples/`. Tests, the seed script, and the design reference all use them, so each sample recipe exists once.

### 4.2 Dependency rules and enforcement

- Domain imports only `zod` and pure helpers from `src/lib`. Application imports domain and `src/lib`. Neither imports Next.js, React, Drizzle, or a vendor SDK.
- Presentation never imports infrastructure. Route Handlers that mount a vendor handler (the Better Auth endpoint) obtain it from composition.
- Only `src/lib/env.ts` reads `process.env`. Everything else receives configuration from it. The exceptions are entry points that run outside Next, where `env.ts`'s `server-only` import cannot resolve:
  - `drizzle.config.ts`, which drizzle-kit loads.
  - The scripts in `scripts/`, which tsx runs with `scripts/tsconfig.json`. It maps `@/` to `src/` and `server-only` to Next's empty module (the alias Vitest uses), so scripts can import server modules.
  - Each loads `.env.local` with `@next/env` and reads its own variables with Zod. Under tsx, `@next/env` is imported whole, because it is bundled CommonJS.
- Server modules begin with `import 'server-only'`. Client components (`'use client'`) import only components, domain types, and pure helpers.
- **Enforcement.** `pnpm lint:boundaries` runs dependency-cruiser with `.dependency-cruiser.ts` (the owner's precedent from sage, kept to a short hand-written rule list). Type-only imports count. It checks that:
  - domain imports only domain, pure `src/lib` helpers (not `env.ts` or `logger.ts`), and `zod`;
  - application imports only application, domain, `src/lib` without `env.ts`, `zod`, and `server-only`;
  - infrastructure and composition never import presentation, presentation never imports infrastructure, and components never import composition;
  - `src/lib` imports no other layer;
  - test kits and Vitest are imported only by tests;
  - there are no cycles and no unresolvable imports;
  - every application, infrastructure, and composition module imports `server-only`, except the two files drizzle-kit loads outside Next (`schema.ts` and `connection-string.ts` in `src/infrastructure/db/`).
- ESLint forbids `process.env`, `globalThis.process`, and importing `process` outside `src/lib/env.ts`, `drizzle.config.ts`, and `scripts/`, and requires every `logger` message in `src/` and `scripts/` to be a string literal. dependency-cruiser checks `src/` only: a script is its own composition root.
- A rule that tooling cannot enforce is written here and checked in review.

### 4.3 Patterns

| Pattern | Where | Why |
| --- | --- | --- |
| Repository | `RecipeRepository` and `MemberRepository` ports with Drizzle adapters | Services and tests do not depend on how data is stored. |
| Query port | `RecipeSearch` with `DrizzleRecipeSearch` | Postgres matches, ranks, highlights, and counts facets; the service validates input and maps results to DTOs. |
| Strategy | `RecipeExtractor` port with JSON-LD, AI text, and AI vision implementations | The entry modes differ only in how a draft is produced. |
| Adapter | Every infrastructure class | Vendor APIs are translated into port contracts. |
| Composition root with constructor injection | `src/composition/` | Explicit wiring without a DI framework, and fakes injected in tests. |
| Value object | Amounts, durations, yields, slugs, tags | Each invariant lives in one place. |
| Mapper | Infrastructure (row to domain) and application (domain to DTO) | Each boundary owns its translation. |
| Draft, review, save | All three entry modes | AI output is never saved unreviewed: every mode produces a `RecipeDraft` that the member reviews in the same form before saving. |

**OOP where it earns its keep.** Services, adapters, and extractors are classes that implement interfaces and receive dependencies through their constructors. Domain data is immutable plain objects described by Zod schemas, because data crossing the Server and Client Component boundary must be serializable. Behavior on that data lives in small pure modules beside its schema.

### 4.4 Next.js conventions

- Server Components by default; `'use client'` only at interactive leaves.
- Mutations are Server Actions that validate input with the domain schema, call one application service, and then invalidate cache tags.
- Route Handlers only for HTTP-shaped needs: the auth endpoint, Blob client-upload tokens, and image delivery. Open Graph images, icons, the manifest, the sitemap, and robots use Next's metadata file conventions.
- `proxy.ts` (Next 16's replacement for `middleware.ts`) makes optimistic redirects only on the contribute and admin routes; its matcher excludes metadata files. The authoritative check is the application layer, on every call.
- Cache Components (`'use cache'`, `cacheTag`, `cacheLife`) for public pages, which are the same for every visitor. Session-dependent UI (sign-in state, an Edit button) streams in behind Suspense, following the bundled guide `authentication-with-cache-components.md`.
- **Cached reads:** `src/app/_lib/recipe-cache.ts` is the one home for recipe cache tags (`recipes` for every list page, `recipe:<slug>` for a recipe) and for the cached reads pages use. Server Actions invalidate with `updateTag`, using `RecipeRef`'s slug. The application layer never imports `next/cache`.
  - The reads use `cacheLife('days')`, and writes invalidate the tags. A result consumed into a prerendered shell persists in Vercel's ISR cache and revalidates in the background, which catches edits made outside the app.
  - A runtime entry, such as a list page read after `searchParams`, lives in the instance's in-memory cache: it is not shared between instances, and a day after it was cached it counts as a miss and is rebuilt while the request waits.
  - List pages are cached per page and sort (`getCachedRecipePage(page, sort)`), which keeps the keys few.
  - A `'use cache'` argument is part of the key, so pass a fresh object with every key present and arrays sorted, never raw `searchParams`.
- **Search is not cached.** Every query and filter makes its own URL, so entries would rarely be reused and would push list entries out of the in-memory cache. The bundled docs name search filters as the worst case for `'use cache: remote'`. Results are read inside Suspense on every request, and a Vercel WAF rate-limit rule on `/search` protects Neon's compute-hours (section 5.5).
- **Dynamic routes:**
  - With Partial Prefetching, `params` and `searchParams` are read inside `<Suspense>`, with skeleton fallbacks that mirror the page. No `loading.tsx`.
  - A `notFound()` inside Suspense keeps status 200 and adds `noindex`, so unknown slugs, invalid parameters, and pages past the end get a soft 404. A `redirect()` there is a client-side redirect with status 200, and a `next.config` redirect cannot drop a query parameter (the request's query is merged into the destination), so a page names its normalized URL with `alternates.canonical` instead.
  - `generateStaticParams` must return at least one param or the build fails. Recipe pages return the first page's slugs, or a placeholder that fails the slug schema and prerenders a 404 while production is empty.
  - `MainNav` reads `usePathname` inside Suspense, with a fallback that marks no link as current.
- **Metadata routes** inside a route group get a hash suffix (`/recipes/<slug>/opengraph-image-<hash>/<id>`). Every named export of a metadata file is re-exported into its route, so helpers stay unexported.
- **URL state:** search state lives in the URL (`searchParams`) so results are shareable and work with the back button.
  - The list keeps its page and sort there (`/?sort=title&page=2`). Defaults are left out, so each view has one URL, and `generateMetadata` on `/` sets the canonical URL, so `/?page=1` names `/`.
  - Search uses `q`, `tag` (repeated), `source`, `time`, `added`, `sort`, and `page`. `src/components/search/search-params.ts` is the one module that parses and builds them.
  - An empty value means absent, because forms submit blank fields.
- **Forms:** `next/form` for every GET form. It navigates client-side and still submits natively before hydration.
  - It drops a query string in `action`, so state travels in hidden inputs.
  - With JavaScript it drops a submit button's name and value, so no state lives in a button.
  - `useFormStatus` never reports pending for it in the App Router.
  - Before hydration, the query field, links, and native `<details>` work. Base UI selects and checkboxes do nothing, so filters and sort need JavaScript; with JavaScript off, Suspense content never appears at all.

### 4.5 Target structure

```text
assets/fonts/             static TTF subsets for Open Graph images, with their licenses
scripts/                  entry points run with tsx outside Next (seed)
  seed/photos/            seed photos and their sources
src/
  app/                    presentation: routing, thin pages and actions
    _lib/                 cached reads and cache tags shared by routes
    (browse)/             public: recipe list and detail, search
    (contribute)/         approved members: add, edit, import
    (account)/            request access, accept an invite, sign in, privacy
    admin/                access requests and members
    design/               design reference (development and previews only)
    api/
      auth/[...all]/      Better Auth handler
      uploads/            Blob client-upload tokens
      images/[...path]/   image delivery: public dish photos, members-only scans
  components/
    ui/                   shadcn primitives
    <feature>/            feature compositions (recipe, search, layout)
  domain/
    recipe/               schemas, value objects, pure functions, errors
    member/
  application/
    ports/                interfaces the use cases depend on
    recipes/
    ingestion/
    search/
    access/
  infrastructure/
    db/                   Drizzle schema, client, migrations, repositories
    storage/
    ai/
    web/
    auth/
  composition/            composition root
  lib/                    env, logger, shared helpers
```

At the root, `drizzle.config.ts` configures drizzle-kit, `vercel.json` sets the build command that migrates and seeds before `next build`, and `.dependency-cruiser.ts` holds the boundary rules.

Files are kebab-case (`recipe-repository.ts`), classes and types PascalCase, functions camelCase. Non-component modules export inline. Tests sit beside the code they test as `*.test.ts`.

### 4.6 Cross-cutting concerns

- **Configuration:** `src/lib/env.ts` validates every variable with Zod once and exports a typed object, so later sessions add their variables there. Today it holds:
  - `NODE_ENV`, `VERCEL_ENV`, and the pooled `DATABASE_URL`;
  - `BLOB_STORE_ID`;
  - `VERCEL_PROJECT_PRODUCTION_URL`, from which it derives `siteUrl` (production's origin on every deployment, `http://localhost:3000` when absent).

  Vercel supplies the values; local development pulls them with `vercel env pull`. The Blob SDK reads and refreshes Vercel's OIDC token itself; there is no read-write token. `drizzle.config.ts` and the scripts read their own variables (section 4.2).

- **Errors:**
  - Expected failures are classes extending `AppError` (`src/lib/errors.ts`) with a stable `code`: `recipe.invalid`, `recipe.not-found`, `recipe.invalid-page`, `recipe.invalid-search`, `access.sign-in-required`, `access.forbidden`.
  - Reads return `null` when nothing is found; writes throw. Validation failures carry problems with dotted paths (`ingredientSections.0.lines.2.item`), the same shape drafts use, so the form renders both alike.
  - Server Actions return expected errors as values and rethrow anything else, as the bundled error-handling guide says. Production masks thrown server errors to a digest, so a code never reaches the client by being thrown.
  - Presentation maps codes to user-facing messages, and unexpected errors reach Next.js error boundaries.
- **Logging:** `getLogger(name)` in `src/lib/logger.ts` writes one JSON line per event (`level`, `logger`, `message`, camelCase fields, and `err` serialized with its code and cause) through the console method matching the level, because Vercel takes a line's level from the console method, not from the JSON. It has no dependency. Messages are constant (ESLint enforces it), with values in the fields. Lifecycle events (recipe created, import started or failed, access requested or granted, invite issued) log at info with the acting `memberId`, recoverable problems at warn, failures at error. Never log tokens or family members' contact details.
- **Validation:** Zod at every boundary: form input, AI output, scraped data, and every database read of a recipe document.
- **Testing:**
  - Vitest for domain and application code, with in-memory fakes for ports. Vitest aliases `server-only` to Next's own empty module, so server modules import in tests.
  - Repository tests run against PGlite (Postgres 18.3 in WASM, loading `pg_trgm` and `unaccent` from its contrib modules) built by the real migrations, inside `pnpm test`, with no secrets or branch quota. `pgvector` ships separately, as `@electric-sql/pglite-pgvector`.
  - PGlite differs from `pg` in two ways tests cannot catch: `pg` returns `count(*)` as a string (use Drizzle's `count()` or `::int`), and PGlite rejects a migration chunk holding more than one statement.
  - Search's expected-result tests run over every sample recipe, the same corpus previews are seeded with.
  - Playwright for a few end-to-end flows once the core flows exist.
  - Fixtures are synthetic or public-domain recipes, never real family data.
  - Infrastructure adapters are tested against real engines, never module mocks. `BlobImageStore` is a thin pass-through with no local engine, so the seed run and the preview verify it.
  - Presentation logic that is pure (JSON-LD mapping, page numbering) is tested beside its component.

## 5. Specifications and constraints

### 5.1 Recipe model

The normalized shape every entry mode produces, finalized in Session 2 in `src/domain/recipe/`.

- **Content** (member-editable): a title; an optional description, notes (the story behind the recipe), and source (who or where the recipe comes from, such as "Grandma Rose" or a cookbook, distinct from the member who entered it).
- **Yield and times:** a yield is servings or "makes" an amount with an optional unit ("Serves 4 to 6", "Makes 10 biscuits"). Times are optional prep, cook, and total minutes; a stated total wins, otherwise prep plus cook.
- **Amounts:** a positive decimal or a range (`{ min, max? }`), displayed as the nearest common fraction (halves, thirds, quarters, eighths). Units are free text as written.
- **Ingredients and steps:** ingredient sections, each with an optional heading and lines that keep the original text verbatim beside their amount, unit, item, and preparation note. Instruction sections of steps, each an object with text, so a step can gain fields without reshaping stored recipes.
- **Tags** are dynamic, with no fixed vocabulary or groups. The first recipe to use a tag sets its label; later spellings that differ only in case or spacing reuse it, and a contributor can respell a tag that only their recipe uses. Two saves racing to introduce the same new tag in different spellings can keep both; at this scale that is accepted and fixed by a merge.
- **Images**, each with a role: dish photos (public; the first is the cover) and original scans (members only). Array order is display order.
  - Each image is a Blob pathname plus optional alt text. A pathname starts with its role (`dish/` or `scan/`) and has only plain segments (letters, numbers, `_`, `-`, `.`), because `..` or `%2e%2e` would climb from `dish/` into `scan/` once the SDK builds the blob URL.
  - Only JPEG, PNG, WebP, and AVIF are served (`recipeImageContentTypes`).
  - No dimensions are stored yet: every screen shows photos in fixed-aspect boxes.
- **Provenance**, set at creation: the entry mode (`manual`, `url` with its source URL, or `photo`) and which model produced an AI draft.
- **Identity:** uuidv7 ids generated by Postgres 18, a slug assigned once from the title (ASCII, at most 60 characters, `-2` and up on a collision) and never rewritten, so shared links keep working, the contributor, and timestamps.
- **`RecipeDraft`:** the same content with every field optional, plus provenance and problems. Drafts are never saved; members review them in the recipe form.

**Storage.** One `recipes` row per recipe: `content` (a jsonb document), `provenance` (jsonb), `tags` (`text[]`), and columns for id, slug, contributor, and timestamps. The mapper validates every read with the domain schema, which keeps schema changes small:

- An added optional field needs no migration.
- A new required field needs a default or a one-statement backfill.
- A rename or restructure is a small SQL data migration.
- A field that needs filtering or sorting becomes a generated column computed from `content`.

**Search columns** (Session 4) are STORED generated columns, computed by Postgres from `content` and `tags`:

- `search_vector`: the weighted `tsvector`.
- `search_words`: the unaccented title, ingredient items, and tags, which close matches compare.
- `tag_keys`: each tag lowercased like `tagKey`.
- `source_key`: the source, lowercased.
- `total_minutes`: by `totalMinutes`' rule.
- `title_sort`: the title unaccented and lowercased.

How they behave:

- Recipe reads select the original columns only (`recipeColumns`).
- They recompute when a write sets a column they read.
- Changing a helper function, the text search configuration, or `unaccent`'s rules recomputes nothing, so such a change ships with a backfill (`UPDATE recipes SET content = content`).
- A document without a title, or with times that are not whole numbers, cannot be stored, because the columns would fail.

Unknown keys are dropped on read, so older code that re-saves a recipe would drop fields newer code added; add fields in one deployment before anything depends on them.

### 5.2 Entry modes

- **Manual entry:** the recipe form, which is also the review form for the other two modes.
- **URL import:** server-side fetch with SSRF protection (public HTTP(S) addresses only, size and time limits), schema.org `Recipe` JSON-LD parsed first, AI filling gaps or handling pages without structured data, and the result opened as a draft for review.
- **Photo import:** one or more images uploaded from the browser straight to Blob. AI vision transcribes and structures them into a draft, and the originals stay attached to the recipe.
- AI output is validated against the domain schema. A failure produces a partial draft with the problems flagged, never a silent save.

### 5.3 Search

Public, at `/search`, with Postgres full-text search, `pg_trgm`, and `unaccent` (decided in Session 4).

- **Matching:**
  - A weighted `tsvector`: A the title; B ingredient items and tags; C the description, notes, and source; D the steps. Ingredient items are indexed rather than verbatim lines, so units and amounts never match.
  - Queries go through `websearch_to_tsquery`, which gives quoted phrases, `-` exclusions, and `or`, and never raises a syntax error. Curly quotes, which phones type, are read as quotes.
  - The `public.recipe_english` text search configuration runs `unaccent` before English stemming, so "creme brulee" finds "Crème brûlée" and the highlight keeps its accents. Tag keys keep accents, as `tagKey` does.
- **Close matches:**
  - When nothing matches exactly, a second query compares the included words with `search_words` by `word_similarity`, at 0.5 or more. pg_trgm's default of 0.6 misses a one-letter slip in a short word ("chiken" scores 0.5).
  - Excluded terms still exclude. The page says "No exact matches for “chiken”. Showing close matches."
- **Filters:**
  - Tags combine with AND and compare by key.
  - Source compares ignoring case.
  - Total time is "or less" (15, 30, 60, or 120 minutes), and recipes without a time drop out.
  - Date added is a rolling past week, month, or year.
  - A contributor filter waits for Session 5's display names.
- **Facets:** tags are counted within the results, so a count is what adding that tag would leave. Sources are counted with every filter but the source, so another source can be chosen.
- **Sorting:**
  - Best match is offered only with a query and is then the default. It ranks with `ts_rank_cd` (default weights, no length normalization), or by similarity for close matches.
  - Newest is the default otherwise.
  - A to Z sorts by `title_sort`.
  - Every order ends with the id, so ties are stable across pages. The list at `/` offers Newest and A to Z.
- **Highlights:**
  - `ts_headline` runs for the page's rows only and marks matches with control characters, which the adapter splits into text segments. Nothing from a recipe is ever rendered as HTML.
  - The snippet comes from the first of the description, ingredient lines, notes, and steps that matched, with "…" where a fragment is cut. Otherwise it is the description.
- **Pages:** 24 results a page, numbered with the shared `RecipePagination`.
- **Input:** the service bounds what a public URL supplies: a query of at most 200 characters, at most 20 tags, and no NUL characters, which Postgres text cannot hold. A source is unbounded, because the filters offer every source recipes use. Invalid input gets the soft 404.
- **Later:**
  - BM25 with Neon's `lakebase_text`: the storage is ready, but it is 0.1.x, cannot run in PGlite, and Free-plan support is unconfirmed.
  - Semantic search with `pgvector` after Session 7: embedding every public query clashes with members-only AI.
  - "Did you mean" corrections from a words list.

### 5.4 Access control

- **Public:** browsing, recipe pages, search, and dish photos need no account. Public pages never show contact details or access-request data.
- **Members:** adding, editing, and importing recipes, and every AI feature, require an approved member. Two roles, `member` and `admin`, live in the database, never in code. Authorization stays in the application layer; Better Auth's admin plugin is not used, so there is one authorization path.
- **Requesting access:** a public form (name, how they know the family, an optional email) creates a request, not an account. It is protected by Vercel BotID and a rate limit. The admin gets an email (section 5.5) and sees a pending count on the admin page.
- **Reviewing:** the admin approves or denies on the admin page, through Server Actions that re-check authorization. Notification emails link to the request page. One-click approve links are not planned (a Session 5 fork), because mail scanners follow links and such tokens would be a second way to authenticate.
- **Invites:** approval produces a single-use, expiring invite link, stored only as a hash, which the admin sends by text or email. Accepting it creates the member's account in one of two ways: register a passkey through Better Auth's passkey plugin (passkey-first registration that consumes the invite), or, on a device that cannot hold a passkey, enter an email address and confirm it with a one-time code. Adding a device or recovering access means a new invite.
- **Sign-in:** passkeys are the main method. Members who joined with an email sign in with Better Auth's email one-time codes, with the plugin's own sign-up disabled, so codes work only for accounts created through an invite. No social sign-in.
- **Previews:** passkeys are bound to their domain, so production passkeys do not work on preview URLs. A script mints an invite against the preview's Neon branch.

### 5.5 Hosting and environments

- Vercel project `recipe-hub` in team `jrichard-personal` (Pro plan). Functions, Neon, and Blob are all in `iad1`.
- Production is `https://recipes.jakerichard.tech`: a CNAME (TTL 300) in the `jakerichard.tech` Route 53 zone, with a Let's Encrypt certificate managed by Vercel. The `vercel.app` production alias redirects to it with a 308, as the personal-site project does for its own alias.
- The Route 53 zone is in the owner's personal AWS account: use `--profile personal`. The default AWS profile is a work account and is never used for this project.
- No staging environment. Pull requests get preview deployments behind Vercel Authentication, and each gets its own Neon branch, `preview/<git-branch>`, created by the integration and deleted by `.github/workflows/preview-branch-cleanup.yml` when the pull request closes.
- Local development uses the Neon branch `develop` through Development-scoped variables, never production.
- Every build migrates its database before `next build` (`vercel.json`'s `buildCommand`). The previous deployment keeps serving during and after a production build, and Skew Protection keeps old Server Actions alive for 12 hours, so migrations are expand then contract: additive first, removals in a later deployment.
- Every build then runs `pnpm db:seed`, which seeds preview branches with 30 synthetic recipes (four with photos) and refuses production, so production never holds synthetic recipes. The recipes double as search's expected-result corpus, so search can be checked on every preview.
  - The seed is idempotent: it skips recipes whose slug exists and uploads only missing photos. A Postgres advisory lock serializes concurrent builds of one pull request, which would otherwise both create a recipe (the second as `-2`).
  - Locally, `pnpm db:seed` seeds `develop` on demand.
  - Seeded recipes belong to a fixed synthetic member id, `00000000-0000-4000-8000-000000000001`, which has no account.
- **Rate limits:** a Vercel WAF rate-limit rule on the path `/search` (fixed 60-second window, 100 requests per IP), created in the dashboard. Blocked requests never reach a function or the database.
  - Pro has 40 such rules, at $0.50 per million allowed requests drawn from the monthly credit.
  - Counters are per region, and prefetches count too, which is why the limit is generous.
  - Start with the Log action and switch to 429 once the logs look right.
- Environment variables are managed in Vercel and pulled locally with `vercel env pull`. The AI Gateway and Blob authenticate with Vercel's OIDC token, so no provider keys or Blob tokens exist. Locally, the Blob SDK refreshes an expired development token with the Vercel CLI's credentials.
  - The Neon integration also adds `PG*`, `POSTGRES_*`, and `NEON_PROJECT_ID` variables. The app reads none of them; they are the integration's to manage and harmless to keep.
- **Blob layout:** one private store, `recipe-hub-images`, serves every environment, since Blob has no branches.
  - Pathnames put visibility first, then the environment: `dish/production/...`, `dish/preview/...`, `dish/development/...`, `scan/<environment>/...`, and seed photos at `dish/seed/<slug>.jpg`.
  - Preview branches copy production's rows, so previews read production's photos.
  - Writes and deletes stay inside their own environment's prefix, so a preview never deletes a photo production uses.
  - Seed photos are reachable through production's image route too. They are public-domain or CC0, so that is harmless.
- Email (access-request notifications, invites when sent by email, and sign-in codes) goes through Resend's free plan, with SPF and DKIM records for a sending domain in Route 53.

### 5.6 Platform limits that shape the design

- Function request bodies are capped at 4.5 MB, so every image upload goes from the browser directly to Blob.
- Neon Free plan: 1 GB storage, 100 compute-hours a month, 10 branches (production, `develop`, and one per open pull request). Preview deployments fail at the branch cap.
  - The compute suspends after 5 idle minutes, and each wake costs at least 5 minutes of compute. Uncached search reaches the database on every request, so a crawler sending unique queries could keep it awake and reach the monthly cap in about two weeks. The WAF rule on `/search` guards against that.
- AI Gateway free tier: $5 a month, a subset of models, and lower rate limits. Buying credits unlocks every model at provider list price.
- Functions run up to 800 seconds on Pro. Import actions set `maxDuration` explicitly.
- Resend free plan: 3,000 emails a month and 100 a day, from a verified domain only.
- `ImageResponse` (Open Graph images):
  - Flexbox and a CSS subset only, no CSS variables or oklch. Static TTF, OTF, or WOFF fonts only: not WOFF2, and not variable fonts.
  - `<img>` sources must be JPEG or PNG: WebP renders blank and AVIF throws.
  - The docs' 500 KB bundle limit is Edge-era wording and is not enforced on the Node runtime.
  - Next 16.4 sends `Cache-Control: public, max-age=0, must-revalidate`, not immutable, so each fetch renders again. Per-recipe image URLs are still versioned, and an old version's URL returns 404.

### 5.7 Sharing and metadata

Recipes are meant to be shared, so links need good previews before the site is used.

- **Icons:** a minimal set as static files: `favicon.ico` (32 by 32), `icon.svg` with a dark-mode variant inside the SVG, `apple-icon.png` (180 by 180), and manifest icons at 192, 512, and 512 maskable, from a brand mark designed with the owner.
- **Open Graph:** `opengraph-image` file conventions with `ImageResponse` from `next/og`. `@vercel/og` ships inside Next and is not installed separately. Requirements:
  - A site-wide image for the root.
  - Per-recipe images (title, source, dish photo) generated through `generateImageMetadata`, with the recipe revision in the image id so an edit changes the URL.
  - `twitter.card` set to `summary_large_image`, using the Open Graph image.
  - `metadataBase` set explicitly from `env.ts` (`siteUrl`, from `VERCEL_PROJECT_PRODUCTION_URL`), since Session 3. Next's own fallback covers only Open Graph images, while canonical URLs, `og:url`, and JSON-LD need absolute URLs. On previews, Next points `og:image` at the branch URL regardless.
  - Fonts as committed static TTF instances in `assets/fonts/`, because `next/font` cannot feed `ImageResponse`.
    - Fraunces is instanced from Google Fonts' variable file at SOFT 100, weight 500, optical size 72 (upstream statics have no 500), then subset to Latin: `fonttools varLib.instancer "Fraunces[SOFT,WONK,opsz,wght].ttf" SOFT=100 wght=500 opsz=72 WONK=0` and `pyftsubset --layout-features='kern,liga' --no-hinting` with the Latin unicode list.
    - Hanken Grotesk Regular is the upstream static file, subset the same way.
    - fontTools runs in a throwaway virtualenv, not as a dependency.
  - The card's colors are constants that mirror the light theme tokens in sRGB, because Satori reads neither CSS variables nor oklch.
- **Structured data:** schema.org `Recipe` JSON-LD on recipe pages (bundled guide `json-ld.md`), typed with `schema-dts`.
  - Fields: ISO 8601 times (prep and cook only as a pair), ingredients as written, `HowToStep`s with named `HowToSection`s for headed sections, yield, keywords from tags, and every dish photo as an absolute URL.
  - It omits `author` until contributors have public names (Session 5), since a source can be a cookbook rather than a person.
  - It powers rich results only if pages are indexed (Google requires an image), and helps recipe apps import our pages.
- **Crawling:** pages carry `noindex, follow` through the root layout's metadata until launch, not a robots.txt rule, which Google cannot see past.
  - `robots.ts` allows everything, so crawlers can read each noindex and link-preview bots can fetch Open Graph images.
  - `sitemap.ts` arrives with the indexing flip in Session 8. Google advises listing only URLs you want indexed, and Next does not escape sitemap XML (slugs are ASCII).
  - Vercel adds `X-Robots-Tag: noindex` to previews.
- **Verification:** Meta's Sharing Debugger and Google's Rich Results Test on production. Previews sit behind Vercel Authentication, so outside crawlers cannot fetch their images.

### 5.8 Project conventions

- **Formatting:** the owner's shared scheme from the Vispero/sage project: Prettier with tabs, single quotes, width 100, `es5` trailing commas, LF line endings, and perfectionist import sorting. Run `pnpm format`; never hand-format against it.
- **Scripts:** `lint` runs every `lint:*` script, so new checks are added as `lint:*`. Scripts that run app code outside Next live in `scripts/` and run with `tsx --tsconfig scripts/tsconfig.json` (section 4.2).
- **Commits:** a plain imperative sentence describing the change, without prefixes.
- **Dependencies:** added with their first consumer, chosen against current documentation, installed with pnpm. pnpm blocks dependency build scripts, so each package that has one is listed in `pnpm-workspace.yaml`'s `allowBuilds` deliberately (`esbuild: false`: drizzle-kit's bundler runs from its platform package without the script).
- **Migrations:** change `src/infrastructure/db/schema.ts`, run `pnpm db:generate --name <change>`, and commit the generated files. Never edit an applied migration. drizzle-kit 0.31 applies only migrations newer than the last one applied, so an older migration merged late would be skipped silently. `drizzle-kit check` (`pnpm lint:migrations`) only warns about that, so a test fails when the journal is out of timestamp order.
  - Extensions, functions, and text search configurations, which drizzle-kit does not model, go in a custom migration (`pnpm db:generate --custom --name <change>`), journaled before anything that uses them. Put `--> statement-breakpoint` after every statement: PGlite rejects a chunk holding two.
  - The migrator applies every pending migration in one transaction, so `CREATE INDEX CONCURRENTLY` cannot be used.
  - Adding a STORED generated column rewrites the table under an exclusive lock, held until that transaction commits, which blocks the previous deployment's reads. At today's size this takes milliseconds. Once the table is large, combine additions into one `ALTER TABLE` and set `lock_timeout` first.
  - Never interpolate a JavaScript value into a generated or index expression: drizzle-kit writes it as `$1`. Write constants literally, or through one `sql.raw` constant (`recipeSearchConfiguration`).
  - Changing a generated column's expression: drizzle-kit 0.31 drops and re-adds the column without its indexes (drizzle-orm issue 4929). Rewrite the generated statement to `ALTER TABLE ... ALTER COLUMN ... SET EXPRESSION AS (...)`, which keeps them.
  - An immutable SQL wrapper uses a SQL-standard `RETURN` body with schema-qualified names, because Postgres 17 and later run index builds and maintenance with a restricted `search_path`.
- **UI primitives:** added with `pnpm shadcn add <name>`, then `pnpm format` and `pnpm exec eslint . --fix` (section 6.3).
- **Documents:** `README.md` for setup, this file for plan and guidance, `AGENTS.md` for agent instructions.

## 6. Design language

The UI must feel consistent and deliberate. This section is the binding design language, settled with the owner in Session 1. The design reference at `/design` (development and preview deployments only, a static 404 in production) shows every token, primitive, and composition; a change to the language is tuned there first and recorded here.

### 6.1 Rules

- **Tokens only.** Color, typography, radius, spacing, shadow, and motion come from tokens in `src/app/globals.css` (Tailwind v4 `@theme`). Outside `src/components/ui/`, code never uses raw color values, arbitrary values such as `text-[13px]`, inline style objects for visual values, or one-off styles. The one exception is Open Graph images: `ImageResponse` takes inline styles only, so the card defines a few colors once, as constants that mirror the light theme tokens.
- **Semantic names.** Components use semantic tokens (background, card, popover, primary, secondary, muted, accent, destructive, border, input, ring) rather than palette steps, so a theme changes in one place. Every token is defined for both themes.
- **Primitives first.** Screens are built from the primitives in `src/components/ui/`. A new look is a new variant on the primitive, never an override at the call site. Primitives keep shadcn's generated class strings, arbitrary values included, so upstream changes merge cleanly; each deliberate change is listed in 6.5.
- **One of each.** One type scale with paired line heights, one radius token, one focus treatment, one set of motion durations that respects `prefers-reduced-motion`.
- **Content is airy, chrome is compact.** Recipes are read while cooking: generous spacing, `text-lg` and a reading-width column for ingredients and steps; compact navigation and controls.
- **Accessible.** WCAG 2.2 AA in both themes: every text and background token pair is checked (4.5:1 for text, 3:1 for input borders and focus indicators), including hover states; visible focus; full keyboard operation; targets at least 24 by 24 pixels; one `h1` per page and ordered headings; a skip link to `#main`.
- **Voice.** The site reads as a general-purpose recipe catalog. That access is limited to the owner's family is a permission rule, never a theme in the copy: no "family" in UI text. Copy is plain and in sentence case, actions say what they do ("Save recipe", then "Saved"), and errors say what went wrong and how to fix it.

### 6.2 Foundations

**Color.** Neutral grays (oklch hue 90, chroma at most 0.004) with one accent, Spruce, a deep blue-green. Red is reserved for destructive actions and errors.

| Token | Role | Light | Dark |
| --- | --- | --- | --- |
| `background`, `foreground` | Page and body text | `oklch(0.99 0.001 90)`, `oklch(0.21 0.004 90)` | `oklch(0.18 0.002 90)`, `oklch(0.94 0.002 90)` |
| `card`, `popover` | Raised surfaces; dark steps lighten for depth | same as background, `oklch(0.995 0.001 90)` | `oklch(0.215 0.002 90)`, `oklch(0.235 0.002 90)` |
| `primary` | Spruce: primary actions, links, active nav, checked controls | `oklch(0.46 0.07 210)` | `oklch(0.78 0.08 205)` |
| `secondary`, `muted` | Quiet fills (badges, notes) | `oklch(0.955 0.002 90)` | `oklch(0.27 0.002 90)`, `oklch(0.25 0.002 90)` |
| `muted-foreground` | Supporting text | `oklch(0.49 0.004 90)` | `oklch(0.72 0.003 90)` |
| `accent` | Hover and highlight fill in menus, tinted with Spruce | `oklch(0.955 0.02 210)` | `oklch(0.29 0.025 205)` |
| `highlight`, `highlight-foreground` | Search matches (`<mark>`), tinted with Spruce; text is `foreground` | `oklch(0.9 0.045 205)` | `oklch(0.38 0.06 205)` |
| `destructive` | Destructive actions and errors | `oklch(0.5 0.19 20)` | `oklch(0.76 0.15 22)` |
| `border` | Dividers and surface edges (decorative) | `oklch(0.9 0.003 90)` | `oklch(0.32 0.003 90)` |
| `input` | Form control outlines, at least 3:1 | `oklch(0.66 0.004 90)` | `oklch(0.52 0.003 90)` |
| `ring` | Focus, equal to primary | `oklch(0.46 0.07 210)` | `oklch(0.78 0.08 205)` |

Lowest ratios: muted text on muted fills 5.49:1 (light); destructive text on its hover tint 4.55:1; input borders 3.02:1 (light) and 3.41:1 (dark). Highlighted text is 13.34:1 (light) and 8.18:1 (dark) on its fill. A token change is rechecked against every pair before it lands.

**Themes.** Light and dark, through the `.dark` class on `<html>` set by `next-themes`. The default follows the device; the header toggle offers Light, Dark, and System. The dark tokens and the `dark:` variant apply on screen only, so printouts always use the light tokens.

**Typography.**

- **Families:** Fraunces with its soft axis (`font-heading`) for page titles, headings, recipe titles, and the wordmark; Hanken Grotesk (`font-sans`) for body text and controls; JetBrains Mono (`font-mono`) for times, yields, and small labels, in uppercase with slight tracking. All three load through `next/font/google` in the root layout.
- **Scale:** `text-xs` to `text-5xl` with paired line heights. Steps from `2xl` up tighten their tracking, and larger steps are removed.
- **Weights and usage:** headings use `font-medium`. Recipe titles are `text-4xl`, rising to `text-5xl` from `md`. Reading text for ingredients and steps is `text-lg`.

**Shape.** One radius token, `--radius: 0.625rem`. Controls use `rounded-md` (0.8 times, 8 px), cards `rounded-xl` (1.4 times, 14 px), and badges are pills.

**Depth.** shadcn's Vega style: cards, inputs, and outline buttons carry a faint `shadow-xs` at rest with a hairline ring. Interactive cards lift to `shadow-md` on hover. The shadow color is a per-theme token, faint on light and deep on dark, so depth reads in both.

**Focus.** One treatment in the ring color: a 1 px full-strength edge inside a 3 px half-strength halo. Controls get it from their primitives (border plus ring), and links from a base rule (outline plus ring).

**Motion.** Our own code adds only short color, opacity, and shadow transitions at Tailwind's default 150 ms, and no glass, blur, glow, or animated text. Primitives keep their generated motion (dialogs fade in over a lightly blurred backdrop, toasts slide in and out). A global rule removes animation and transition time under `prefers-reduced-motion`.

**Layout.**

- **Header:** a sticky, compact top bar (`h-14`) holding the wordmark, the main nav, search, and the theme toggle. On phones, search is an icon link to `/search`; from `sm` it is a field in a `<search>` landmark (`w-56`, `w-72` from `lg`), and it is left out on `/search`, whose own field is the only one there. The bar has room for one more 36 px control at 390 px but not at 360 or 375, so the next one brings the mobile menu.
- **Containers:** `PageContainer` sets the width: `wide` (`max-w-6xl`) for browsing and `reading` (`max-w-2xl`) for recipe content.
- **Browse grid:** one column on phones, two on tablets, three on desktop.

### 6.3 Components and patterns

- **Library:** shadcn/ui on Base UI primitives, Vega style, Lucide icons.
  - Installed primitives: attachment, badge, button, card, checkbox, dialog, dropdown-menu, empty, field, input, input-group, label, pagination, select, separator, skeleton, spinner, tabs, textarea, toast, tooltip.
  - Add more with `pnpm shadcn add <name>`, then `pnpm format` and `pnpm exec eslint . --fix`, plus a demo on `/design`.
  - When the CLI offers to overwrite a primitive listed in 6.5, decline and keep the customized version.
- **Composition:** Base UI composes through the `render` prop, not `asChild`. A link styled as a button takes `buttonVariants()` on the link itself, because Base UI's Button must not render links. `cn` comes from the `cn` package.
- **Forms:**
  - Every control sits in a `Field` with a `FieldLabel`, helper text, and `FieldError`. A disabled field sets `data-disabled` on `Field` so its label dims; `peer-disabled` never matches Base UI controls.
  - Textareas grow with their content (`field-sizing: content`) and fall back to a vertical resize handle where that is unsupported.
  - List-shaped input (ingredients, steps) is a list of separate growing fields, with "Add ingredient" or "Add step", a remove button per item, numbering for steps, and optional sections with headings. Focus moves into a new item and to a neighbor when one is removed. Free-form "one per line" fields are not used.
- **File input:** never the bare native control. A dashed drop area with an icon and a "Choose photos" button opens the hidden native input; chosen files appear below as attachments with thumbnails, size, a remove action, and upload states. Changes are announced politely.
- **Feedback:**
  - Toasts use Base UI's toast, mounted once in the root layout. No action buttons in auto-dismissing toasts, because they cannot be reached in time (WCAG 2.2.1).
  - Empty states use the `empty` primitive (`RecipesEmptyState` on the home page).
  - Loading states are skeletons that mirror the final layout (`RecipeCardSkeleton`). A `loading.tsx` goes only in segments that await data, never above a gated route, where it would turn a 404 into a soft 404.
- **Theme:** `ThemeProvider` in `src/components/layout/` holds the next-themes configuration. `ThemeToggle` swaps its sun and moon icons with `dark:` classes so the server render never depends on the theme.
- **Recipes:**
  - `RecipeCard` takes a `RecipeSummaryDto`. A recipe without a photo keeps the same 4:3 box, in `bg-muted` with a muted cooking-pot icon, so every row lines up.
  - Card photos are decorative (`alt=""`). A card's or result row's link is named by its title (`aria-labelledby`) and described by its source, snippet, and details (`aria-describedby`), so a screen reader does not read the whole card as the link's name. Cards in the first row and the first three search results load eagerly.
  - `recipe-summary.tsx` holds what the card and the result row share: the 4:3 cover or no-photo box (`RecipeCover`), the facts, and the tags.
  - `RecipeDetail` takes a `PublicRecipeDto` and a heading level: 1 on recipe pages, 4 under `/design`'s own headings.
  - The detail shows the source, the dates added and edited (en-US, America/New_York, in `<time>`), a 3:2 cover that preloads and is hidden in print, ingredients and steps in `text-lg`, and notes.
    - An ingredient line with an amount shows the amount and unit in bold, then the item and preparation; a line without one shows its original text.
    - Step numbers restart in each section.
  - `recipeTextStyles` in `recipe-detail.tsx` holds the recipe text hierarchy.
  - `RecipePhoto` is the one fixed-aspect `next/image` box.
  - The site's name has one home, `siteName` in `src/components/layout/site-name.ts`.
- **Pagination:**
  - `RecipePagination` shows Previous and Next only where they lead somewhere.
  - It shows the first and last pages, the current page with one on each side, and an ellipsis for longer gaps (a gap of one page shows that page), plus a "Page 3 of 5" label.
  - It wraps on narrow phones rather than scrolling sideways.
  - It takes a `pageHref(page)` function, so the list and search share it and each keeps its own parameters.
- **Sorting:** `RecipeSortForm` is a GET form whose `Select` submits on selection, with the page's other state in hidden inputs. Paging keeps the order.
- **Search results:**
  - `/search` holds the query form (field, "Search" button, a hint about phrases and exclusions), the filters, and the results.
  - Filters sit in a sidebar from `lg` and in a native `<details>` "Filters" disclosure below it, both rendered from one component, each in its own form. They apply with an "Apply filters" button, never on each change, so choosing several loads once.
  - Above the results are the active filters as removable chips, "Clear filters", the count in a polite status (`<p role="status">`, with an sr-only note of the query, close matches, order, and page, so a new search or page is announced even when the count is the same), and the sort.
  - Results are `RecipeSearchResult` rows in a divided list: a small 4:3 cover, the title as a heading, the source, a two-line snippet, the facts, and the tags.
  - `HighlightedSegments` renders highlighted text as text and `<mark>`. A base rule styles `<mark>` with the highlight tokens and bolder weight, the cue that does not rely on color.
  - No-result states use the `empty` primitive, with a way forward (clear the filters, or shorten the search). Close matches carry a line above them.
- **Disclosures:** native `<details>` with a `<summary>` styled by `buttonVariants` and a rotating chevron. A base rule hides the browser's marker.
- **Printing:** the header and the cover photo are hidden, and sections, steps, and notes avoid page breaks.

### 6.4 References

The owner likes [tanstack.com](https://tanstack.com/) and [mstone.ai](https://mstone.ai/). Observations from their markup, CSS, and screenshots (October 2026):

- **TanStack:** a token-driven system.
  - Type: Bricolage Grotesque for display, Inter for body, IBM Plex Mono for small uppercase labels. Weight carries the hierarchy more than size.
  - Layout and color: a dense 42 px sticky nav, a 660 px docs reading column, and flat surfaces with 1 px warm-gray borders. One orange accent appears only on the active item and the wordmark.
  - Dark theme: steps from `#0a0a0a` through lighter grays.
- **mstone.ai:** renders light, with a floating black nav bar, very tight tracking (about -0.035em) on heavy headings, and a single electric-blue accent. General Sans with JetBrains Mono for small uppercase labels, soft shadows, glassy tiles, and 9 to 12 px radii.
- **What was borrowed:** one disciplined accent used sparingly, tight tracking on large headings, a mono for metadata, quiet transitions, and a sticky compact top bar. What was not: glass, glows, and animated text.

### 6.5 Deliberate changes to generated primitives

- `button.tsx` and `badge.tsx`, `default` variant: hover darkens the primary 10% toward the foreground instead of fading it to 80%. White text on faded Spruce is 4.26:1, which fails AA; on the darkened hover it is 7.48:1.
- `button.tsx`, `destructive` variant: the focus border is full-strength `border-destructive` instead of 40 percent, so the focus indicator meets 3:1 like every other control.
- `textarea.tsx`: `resize-y supports-[field-sizing:content]:resize-none`, so auto-growing textareas show no handle.
- `pagination.tsx`, `PaginationLink`: renders `next/link` with `buttonVariants({ variant: isActive ? 'outline' : 'ghost', size })` instead of Base UI's `Button` with `render={<a />}`. Base UI's Button must not render links, and `next/link` keeps page changes client-side. Its props are `next/link`'s.
- `select.tsx`, `SelectContent`: `alignItemWithTrigger` defaults to `false`, so the popup opens below its trigger at the trigger's width. Base UI's default lays the selected item over the trigger, offset a few pixels so the popup overhangs it, and only for mouse input, so touch already opened below.

## 7. Decision log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-10-10 | Next.js 16 (App Router), TypeScript end to end, one Vercel project | One Zod recipe schema serves the form, AI output, and database. Zero-config on Vercel. FastAPI with Vite needs Vercel Services (beta) and two copies of the schema; TanStack Start is still a release candidate. |
| 2026-10-10 | Neon Postgres via the Vercel Marketplace (Free plan, `iad1`, Postgres 18, Neon Auth off) | Postgres handles the search. Fast scale-to-zero, billed through Vercel, per-preview branches. Aurora resumes in about 15 seconds and needs IAM setup; Supabase's free tier pauses after a week idle. |
| 2026-10-10 | Private Vercel Blob store `recipe-hub-images` (`iad1`) | Scans stay behind the login, and client uploads avoid the 4.5 MB body limit. Access mode cannot change after creation. |
| 2026-10-10 | Better Auth with the Facebook provider; allowlist in the database (sign-in method superseded below) | Auth.js v5 never went stable and its maintainers recommend Better Auth. A hook before user creation gates sign-up. |
| 2026-10-10 | Drizzle ORM, version chosen in Session 2 | Close to SQL (needed for search) and supported by Better Auth. 1.0 was a release candidate at the time. |
| 2026-10-10 | AI SDK through the Vercel AI Gateway; no provider keys | Owner's choice. OIDC authentication on Vercel; `vercel env pull` locally. |
| 2026-10-10 | pnpm 12, Node 24, ESLint and Prettier, Vitest, GitHub Actions CI | Canonical toolchain; CI runs lint (code and formatting), typecheck, and tests. |
| 2026-10-10 | Formatting scheme matches the owner's Vispero/sage project | One formatting scheme across the owner's projects. |
| 2026-10-10 | Private repository `jaARke/recipe-hub`; repo-local git identity `jake.richard126@gmail.com` | Private is the reversible choice. The identity lets Vercel match commits to the owner. |
| 2026-10-10 | `AGENTS.md` only, no `CLAUDE.md` | Claude Code 2.1.277 and later reads `AGENTS.md` directly. |
| 2026-10-10 | Neon's agent skills not kept in the repository | Owner's choice. The `neon` skill steers toward Neon Auth and Storage, which the stack does not use. |
| 2026-10-10 | shadcn/ui as the component library; design language tuned against tanstack.com and mstone.ai | Owner's choice: flexible, extensible components with a deliberate design language. |
| 2026-10-10 | Production at `recipes.jakerichard.tech` (Route 53 CNAME); no staging environment | Owner's choice. Previews cover pre-production checks. |
| 2026-10-10 | Layered ports-and-adapters architecture with enforced boundaries | Owner's guidance: clear layer responsibilities and guarantees, expressed structurally. |
| 2026-10-10 | shadcn/ui kept after comparing alternatives, on Base UI primitives | geistcn is Vercel's internal package (not on public npm, no license), and Vercel points outside users to shadcn/ui; coss ui, HeroUI, Catalyst, Mantine, and MUI fit a custom design language less well. Base UI is shadcn's default, the only base that does not pull in a second primitive library, and has a funded team; Radix has one active maintainer, and React Aria is the heaviest and newest in shadcn. |
| 2026-10-10 | Vega style, default radius (`0.625rem`), Lucide icons | Owner's choice from side-by-side specimens. Vega's faint resting shadow replaces the proposed "shadow only on interaction". |
| 2026-10-10 | Fraunces (soft), Hanken Grotesk, JetBrains Mono | Owner's choice of a cookbook serif for headings over the proposed display sans. |
| 2026-10-10 | Spruce accent on neutral grays | Owner's choice in a second round: paprika on warm neutrals read too close to Anthropic's look. Every token pair passes AA in both themes. |
| 2026-10-10 | Light and dark themes, default follows the device, through `next-themes` | Platform convention. next-themes 0.4.6 is stale, with an open report of a React script-tag warning that did not reproduce on Next 16.4 and React 19.3; the Next.js guide's inline script is the fallback. |
| 2026-10-10 | A core set of primitives, not the full catalog; Base UI's toast instead of sonner | The smallest set the shell, the reference page, and the next sessions use; more arrive with their first screen. One primitive library and no extra dependency for toasts. |
| 2026-10-10 | shadcn's CSS imported from `shadcn` as a dev dependency, not ejected | Ejecting inlined about 640 lines of variants and utilities, not tokens. The import keeps future `shadcn add` components working and pins the CLI. |
| 2026-10-10 | Arbitrary values allowed only in `src/components/ui/`; `cn` from the `cn` package | Generated primitives keep upstream class strings so updates merge cleanly, and import `cn` directly, so there is one import path and no `src/lib/utils.ts`. |
| 2026-10-10 | Design reference at `/design`, enabled when `NODE_ENV` is `development` or `VERCEL_ENV` is `preview`; `src/lib/env.ts` created | Owner's requirement that it never exists in production. Production prerenders a static 404, metadata included. |
| 2026-10-10 | UI copy reads as a general-purpose recipe catalog | Owner's direction: the family scope is an access rule, not a theme. |
| 2026-10-10 | Ingredients and steps entered as lists of separate fields; file inputs as a drop area with attachments | Owner's feedback: free-form "one per line" fields and the bare native file input are unreasonable for members. |
| 2026-10-10 | Browsing and search public; contributing and AI limited to approved members | Owner's change of direction, so members can share recipes with anyone. Replaces "family only". |
| 2026-10-10 | Sign-in with Better Auth passkeys by admin invite, email one-time codes as the fallback; no Facebook | For a handful of accounts, Facebook's Meta app, Live mode, data-deletion handling, missing emails, and unclear Business Verification outweigh a familiar button. Passkeys cost nothing; codes cover devices older than iOS 16 or Android 9. |
| 2026-10-10 | Access requests reviewed on an admin page; email for notifications and sign-in codes through Resend's free plan | $0 at this volume, and the email-code fallback needs a sender anyway. |
| 2026-10-10 | Sessions reordered: public browsing and search before authentication and authoring | Browsing no longer needs sign-in, so something shareable lands sooner. |
| 2026-10-10 | Icons, manifest, the site-wide Open Graph image, and `metadataBase` in the launch session; per-recipe Open Graph images and JSON-LD with public browsing; `next/og`, not `@vercel/og` | Owner's placement. `@vercel/og` ships inside Next. |
| 2026-10-10 | Drizzle ORM 0.45.4 with drizzle-kit 0.31.11, written ready for 1.0 (no relational queries, no `casing` option, no drizzle-zod) | 1.0 is a release candidate that still breaks APIs between releases, and Better Auth's relations-v2 schema generator has an open bug. 0.45 skips a migration merged out of timestamp order, so a test checks the journal's order. |
| 2026-10-10 | `pg` with `attachDatabasePool` on the pooled URL; migrations on the unpooled URL; `sslmode` pinned to `verify-full` | Neon's and Vercel's recommendation for Fluid compute, with interactive transactions. The HTTP driver has none, and its migrator is not transactional. pg 8 already verifies fully and warns that pg 9 will not. |
| 2026-10-10 | uuidv7 ids from Postgres 18 on every table; a recipe slug assigned once from the title | Readable share links that never break, and one ID strategy that Better Auth's tables can follow in Session 5. Renames keep the slug; duplicate titles get `-2`. |
| 2026-10-10 | A recipe is a jsonb `content` document plus `provenance`, `tags`, and identity columns | Owner's direction: small schema changes stay cheap. Generated columns can read the row's own document, which suits Session 4's search. Replaces one table per section. |
| 2026-10-10 | Amounts as positive decimals or ranges, units as written, original lines verbatim | What Mealie, Tandoor, and parse-ingredient store; display snaps to common fractions. |
| 2026-10-10 | Dynamic tags: the first recipe to use a tag sets its label | Owner's direction, replacing a managed vocabulary with groups. |
| 2026-10-10 | Typed error classes with stable codes; reads return `null`; Server Actions return expected errors as values | The bundled error-handling guide, with one error channel through the layers. A result type would thread through every caller while repositories still throw. |
| 2026-10-10 | Authorization through an `ActorProvider` port with an always-anonymous placeholder until Session 5 | Public reads never resolve the actor, so they stay cacheable; writes resolve it inside the service, as the Next data-security guide's Data Access Layer does. Deployments refuse every write until sign-in exists. |
| 2026-10-10 | Migrations run from `vercel.json`'s `buildCommand`; per-preview Neon branches deleted by a workflow when the pull request closes; a `develop` branch for local work | Versioned, and local `pnpm build` never migrates. The integration deletes a branch only after its last deployment is deleted, and `.env.local` pointed at production. |
| 2026-10-10 | `drizzle.config.ts` is the one file besides `env.ts` that reads `process.env` | drizzle-kit loads it outside Next, where `env.ts`'s `server-only` import cannot resolve. |
| 2026-10-10 | Repository tests against PGlite inside `pnpm test` | Real Postgres 18.3 built by the real migrations, with no secrets, no branch quota, and no CI change. Replaces tests against a Neon branch. |
| 2026-10-10 | Logger: console-backed JSON lines with no dependency | Vercel takes a line's level from the console method. pino writes every level to stdout, so the level filter would show everything as info; LogTape works but is more than the app needs. |
| 2026-10-10 | `error.tsx` lands with Session 3's first data-reading page | Nothing in Session 2 renders data, so a boundary could not be exercised. |
| 2026-10-11 | One private Blob store. Pathnames put visibility first, then the environment (`dish/<env>/...`, `scan/<env>/...`; seeds at `dish/seed/<slug>.jpg`), and the domain requires plain segments under the role's folder | Previews keep reading production's photos from copied rows, and the environment segment lets Session 6 keep preview writes and deletes away from production's. A store per environment would break those photos on previews, and a public store would make every URL permanent. Plain segments stop `..` from reaching `scan/` when the SDK builds the blob URL. |
| 2026-10-11 | Blob authenticates with OIDC (`BLOB_STORE_ID`); the read-write token was removed, not made Sensitive | Short-lived, rotating credentials replace a readable long-lived secret that Vercel flagged. The SDK silently falls back to a token when OIDC fails, so none is kept. |
| 2026-10-11 | Dish photos stream through `/api/images/[...path]` with year-long immutable caching (`s-maxage` for Vercel's CDN). Anything else, or any query string, gets 404 with `no-store`, and only image content types are served (query rule amended below) | Pathnames are never reused, so a response never changes, and a query string would bypass the CDN cache. |
| 2026-10-11 | Vercel image optimization for dish photos through `images.localPatterns`, in fixed-aspect boxes (cards 4:3, the recipe cover 3:2); no image dimensions stored yet | Cropped boxes need no dimensions and cause no layout shift. The optimizer fetches without cookies, so scans never use it. About $0.05 per 1,000 transformations. |
| 2026-10-11 | `pnpm db:seed` (tsx) seeds six synthetic recipes and four public-domain or CC0 photos through `RecipeService` and `BlobImageStore`: on `develop` on demand and in every preview build, never in production | Browsing works before authoring, with the real slug, tag, and validation rules. Production never holds synthetic recipes. |
| 2026-10-11 | Samples moved from `src/domain/recipe/testing/` to `src/domain/recipe/samples/` | Tests, the seed, and the design reference share one copy of each recipe. |
| 2026-10-11 | Recipe list at `/` with `?page=N`: 24 per page, newest first, numbered pagination from a total count; sorting moves to Session 4 | Numbered pages let readers jump, and a count is cheap at this scale. A title sort needs Session 4's unaccent-backed columns to order accented titles correctly. |
| 2026-10-11 | Recipe pages show the source and the dates added and edited (en-US, America/New_York); contributor names wait for Session 5 | Owner's choice. Vercel renders in UTC, so a fixed zone keeps an evening edit on the right day. |
| 2026-10-11 | `noindex, follow` through the root metadata; `robots.ts` allows everything; `sitemap.ts` waits for the indexing flip in Session 8 | Crawlers must reach a page to read its noindex, and link-preview bots must fetch Open Graph images. Google advises listing only URLs you want indexed. |
| 2026-10-11 | `metadataBase` set now (moved from Session 8), from `VERCEL_PROJECT_PRODUCTION_URL`, with localhost when absent | Canonical URLs, `og:url`, and JSON-LD need absolute URLs, and Next's own fallback covers only Open Graph images. It matches Next's fallback and needs no configuration. |
| 2026-10-11 | Open Graph fonts committed as Latin subsets: Fraunces instanced at SOFT 100, weight 500, optical size 72, plus Hanken Grotesk Regular | Satori needs static fonts, and upstream ships no weight-500 soft instance. Nothing is fetched at render time. |
| 2026-10-11 | Cached reads and tag names in `src/app/_lib/recipe-cache.ts`, with `cacheLife('days')` | One home for the tags Session 6's Server Actions invalidate, outside the application layer, which may not import `next/cache`. Background revalidation after a day catches edits made outside the app. |
| 2026-10-11 | `generateStaticParams` returns a placeholder slug while no recipes exist | Cache Components fails the build on an empty result, and production starts empty. The placeholder fails the slug schema and prerenders a 404. |
| 2026-10-11 | Print uses the light tokens: the dark theme applies on screen only | Paper is light. |
| 2026-10-11 | Search with Postgres full-text search, `pg_trgm`, and `unaccent`; not `lakebase_text` BM25 or hybrid `pgvector` | It runs in PGlite, so tests check real ranking, and on Neon's Free plan. BM25's corpus weighting is invisible at this size, and `lakebase_text` is 0.1.x, cannot run locally, and is unconfirmed on the Free plan. Hybrid search would embed every public query, against members-only AI. The storage is ready for BM25 later. |
| 2026-10-11 | Accents ignored through a `recipe_english` text search configuration (`unaccent`, then English stemming), plus an `immutable_unaccent` wrapper for the sort and similarity columns | The configuration keeps accents in highlights. The wrapper is honest about immutability because it names `public.unaccent`, whose rules Neon changes only by support ticket. |
| 2026-10-11 | Close matches only when nothing matches exactly: `word_similarity` of 0.5 or more against the title, ingredient items, and tags | The smallest rule that finds every tested misspelling's recipe first ("chiken", "biscut", "pot rost") while unrelated queries stay empty. Per-word corrections ("Did you mean") can follow. |
| 2026-10-11 | Facets: tags (AND, counted within the results) and source (counted with every other filter); total time and date added as filters without counts; the contributor filter in Session 5 | Tags have no groups, so OR would mostly widen results. Contributors have no public names yet. |
| 2026-10-11 | Sorts: Best match (only with a query), Newest, and A to Z, on `/` and `/search`, each order defined once | Resolves the sorting moved from Session 3. A to Z uses an unaccented key, so accented titles sort beside plain ones. |
| 2026-10-11 | Search results are not cached; a Vercel WAF rate-limit rule guards `/search`; list pages are cached per page and sort; no `'use cache: remote'` | Per-query entries would rarely be reused and would push list entries out of the per-instance cache, and the docs name search filters as remote caching's worst case. Neon's compute-hours are the scarce resource, and the WAF blocks requests before a function runs. Session 5 can add a rule of its own or call `checkRateLimit`. |
| 2026-10-11 | Search at its own route, `/search`, which lists every recipe when empty; `/` keeps the cached home list | Filter-only browsing works, and the home list stays cached. |
| 2026-10-11 | `/?page=1` and other default parameters name `/` through `alternates.canonical` | A `next.config` redirect would loop, a `redirect()` inside Suspense is a client-side redirect with status 200, and `proxy.ts` stays limited to gated routes. |
| 2026-10-11 | Header search: an icon link on phones, a field from `sm`, left out on `/search` | A field at 375 px would show four to nine characters, and a second row would add height to every page. |
| 2026-10-11 | Results as rows; filters in a sidebar from `lg` and a `<details>` disclosure below, applied with a button; only `input-group` added | Rows fit four to five on a phone screen and give snippets room. `<details>` works before hydration and needs no new primitive. Applying on each change would navigate on every arrow key in a select. |
| 2026-10-11 | Highlight tokens tinted with Spruce, with bolder text | One accent hue in the design language; the weight is the cue that does not rely on color. |
| 2026-10-11 | 30 synthetic samples, seeded on previews, double as the search corpus | Search can be checked on every preview against the recipes the tests use. |
| 2026-10-11 | Forms promise "works before hydration", not "works without JavaScript" | Suspense content arrives hidden and is revealed by an inline script, so with JavaScript off results never appear, and Base UI controls need hydration. |
| 2026-10-12 | The image route allows one query parameter, `_vercel_system`, and logs a warning for every query it refuses | Vercel's image optimizer adds it when fetching a source image, so every optimized dish photo had failed with "Bad status code from upstream image" since Session 3, on previews and, once photos exist, production. The platform passes the parameter through from outside requests too, so it can bypass the CDN cache; Session 8 reviews that. |

## 8. Chronology and dependencies

```mermaid
flowchart LR
	S0["0 Project setup (done)"] --> S1["1 Design system and app shell (done)"]
	S0 --> S2["2 Architecture and data (done)"]
	S1 --> S3["3 Public browsing (done)"]
	S2 --> S3
	S3 --> S4["4 Search (done)"]
	S1 --> S5["5 Auth and contributor access"]
	S2 --> S5
	S3 --> S6["6 Authoring"]
	S5 --> S6
	S6 --> S7["7 AI import"]
	S4 --> S8["8 Launch"]
	S7 --> S8
```

- Session 3 (done) seeded synthetic recipes, so browsing works before authoring exists.
- Session 4 (done) added search and grew the seeded samples to 30, which double as its expected-result corpus.
- Session 5 is next. If another session's migration merges first, the later branch regenerates its migration after rebasing, so its timestamp is newest (section 5.8).
- Session 5 needs the design system for its account pages and the data layer for Better Auth's tables.
- Session 6 needs public pages to land on and authentication, so recipes are attributed from the first save.
- Session 7 builds on the authoring form, which doubles as the review form. Semantic search with embeddings created at import is revisited after Session 7.
- Owner actions (section 10) have their own lead times: set up the Resend sending domain before Session 5.

## 9. Sessions

### Session 0: Project setup (done 2026-10-10)

Chose the stack and storage; scaffolded Next.js 16.4 with pnpm, Tailwind v4, ESLint with import sorting, Prettier, Vitest, and CI; applied the shared formatting scheme and `.vscode` settings; created the private GitHub repository; created the Vercel project with Git integration; provisioned Neon and the private Blob store and connected both to the project; served production from `recipes.jakerichard.tech` (Route 53 CNAME, HTTPS, 308 redirect from the `vercel.app` alias); wrote this roadmap.

### Session 1: Design system and app shell (done 2026-10-10)

Delivered:

- **Library:** shadcn/ui on Base UI primitives in the Vega style, with the core set of primitives listed in section 6.3.
- **Tokens and themes:** design tokens in `src/app/globals.css` (Spruce on neutral grays, Fraunces, Hanken Grotesk, and JetBrains Mono, one type scale, radius, per-theme shadows, focus, reduced motion), checked for WCAG 2.2 AA in both themes, plus light and dark themes through `next-themes`.
- **App shell:** a skip link, a sticky header with wordmark, nav, and theme toggle, `PageContainer`, the toast viewport, an empty-state home page, and a styled 404.
- **Feature components:** `RecipeCard`, `RecipeCardSkeleton`, and `RecipesEmptyState`.
- **Design reference:** `/design`, covering tokens, every primitive, and compositions (recipe grid and its loading state, recipe detail, photo upload, and a recipe form with list inputs). It is gated through the new `src/lib/env.ts`.
- **Roadmap:** section 6 rewritten as the final design language, and the access model, sign-in, sharing requirements, and session plan revised with the owner.

Deferred, each to the session that needs it:

- **Session 2:** the duration formatting in `recipe-card.tsx` moves to the duration value object, and an `error.tsx` boundary arrives with the first data reads.
- **Session 3:** resolved there. `MainNav` renders inside Suspense, the recipe text styles live in the real recipe components that `/design` renders, and a larger card title was not needed.
- **Session 5 or 6:** a mobile menu once the nav outgrows the header.
- **Session 6:**
  - A compact textarea size variant for list inputs, which the demo currently sizes at the call site.
  - The reordering interaction for list items.
  - Whether step numbers continue across sections.
- **Session 8:** VoiceOver and TalkBack passes on Base UI menus, combobox, toasts, and drawers.
- **Known quirks, fixed if a screen uses them:**
  - Base UI checkbox has no indeterminate look.
  - `FieldSeparator` paints `bg-background` on cards in dark mode.
  - `Label`'s `peer-disabled` classes never match Base UI controls; use `FieldLabel` in a `Field`.

### Session 2: Architecture foundation, recipe domain, and data layer (done 2026-10-10)

**Goal:** the layered skeleton with enforced boundaries, the recipe domain model, and persistence.

**Delivers:**

- The directory structure in section 4.5, `server-only`, `lint:boundaries` with dependency-cruiser, and the `process.env` restriction.
- The logger, and `src/lib/env.ts` extended with the database variables.
- The recipe domain model from section 5.1: Zod schemas, value objects, `RecipeDraft`, domain errors, and unit tests.
- Drizzle with a Neon driver: schema, migrations run from the build command, Neon preview branching enabled, repositories with mappers.
- Application services for recipe reads and writes, with authorization behind a port that knows an anonymous actor (public reads) and a member (writes), implemented fully in Session 5; the composition root; in-memory fakes and tests.

**Forks:** Drizzle 0.45 or 1.0; Neon driver (serverless HTTP or WebSocket, or `pg` with Fluid compute pooling); ID strategy and URL slugs; how quantities are represented; the tag vocabulary; typed error classes or a result type.

**Done when:** `lint:boundaries` passes and fails on a deliberate violation, a migration runs on a preview branch, and the recipe services are covered by tests.

Delivered:

- **Boundaries:** `lint:boundaries` with dependency-cruiser and the ESLint restrictions in section 4.2, verified to fail on deliberate violations.
- **Shared:** `src/lib/env.ts` with `DATABASE_URL`, the `AppError` base, and the logger.
- **Domain:** the recipe model in section 5.1 with Zod schemas, value objects (amounts, durations, yields, slugs, tags), `RecipeDraft`, problems, `InvalidRecipeError`, a minimal member model, and synthetic samples matching the design reference. `RecipeCard` formats time with the duration value object.
- **Data:** Drizzle 0.45 on `pg` with `attachDatabasePool`, the `recipes` table and its first migration, `DrizzleRecipeRepository` with its mapper, and PGlite repository tests.
- **Application:** `RecipeService` (public `getRecipe` and `listRecipes`; `createRecipe`, `updateRecipe`, and `deleteRecipe` for members, with edits and deletes limited to the contributor and admins), the `RecipeRepository` and `ActorProvider` ports, DTOs, in-memory fakes, and tests.
- **Composition:** `getRecipeService()` in `src/composition/services.ts`, wired with the Drizzle repository and the always-anonymous `AnonymousActorProvider`.
- **Operations:** migrations in the build through `vercel.json`, per-preview Neon branches with a cleanup workflow, and a `develop` branch for local work.

Deferred, each to the session that needs it:

- **Session 3:** resolved there: the `error.tsx` boundary, where seed data lives, the seeded `contributorId`, paging with a total count, and `RecipeCard` taking `RecipeSummaryDto`.
- **Session 4:** resolved there.
  - The search and filter columns are generated from `content` and `tags`.
  - The GIN index went on `tag_keys`, since filters compare keys.
  - `findTagLabels` now narrows rows through that index.
  - BM25 with `lakebase_text` was evaluated and deferred.
- **Session 5:**
  - Configure Better Auth to use uuid ids, because `recipes.contributor_id` is a uuid. Then add its foreign key.
  - Replace `AnonymousActorProvider`.
  - Add a members-only read for scans; the public DTO drops them.
  - Add contributor display names to public DTOs.
  - Decide on pg's `enableChannelBinding` after testing it on a preview branch.
- **Session 6:**
  - Form mapping omits blank optional fields, because the domain rejects blank text.
  - Server Actions map `AppError` codes to messages, and problem paths to fields.
  - Consider shared contract tests that both the in-memory and Drizzle repositories run.
- **Session 7:** extractors drop an invalid amount but keep the line's text. The draft schemas convert to JSON Schema in both directions.

### Session 3: Public browsing (done 2026-10-11)

**Goal:** anyone can browse and read recipes, and shared links preview well.

**Depends on:** Sessions 1 and 2.

**Delivers:**

- Browse: the recipe list (cards, sorting, pagination) and recipe detail (cooking-friendly layout, print styles, source and contributor), as public, cached pages with cache tags.
- An `ImageStore` port and its Blob adapter, and the image delivery route: public dish photos cached at the CDN. Original scans are refused outright until Session 5 wires member authorization.
- Per-recipe Open Graph images through `next/og`, versioned by revision, and schema.org `Recipe` JSON-LD (section 5.7).
- `robots.ts` and `sitemap.ts`, with the indexing decision applied.
- A seeded set of synthetic recipes and photos, so browsing works before authoring exists.

**Forks:**

- **Blob layout.** Recommendation: the one private store with visibility in the pathname (`dish/` public, `scan/` members only) served through the delivery route, rather than a second public store.
- **Indexing.** Recommendation: `noindex` at first, revisited at launch.
- **Which personal details are public.** Recommendation: member-chosen display names for contributors, sources as entered, and scans for members only.
- **Open Graph fonts.** Recommendation: committed static TTF instances rather than fetching fonts at render time.

**Done when:** a seeded recipe is readable signed out on a preview, its link previews with the right image in the deployment's Open Graph tab, and the services and mappers are tested.

Delivered:

- **Browse:** two public pages, read through cached functions tagged `recipes` and `recipe:<slug>`, with skeleton fallbacks and a root `error.tsx`.
  - The recipe list at `/`: cards with a cover photo or a no-photo box, and numbered pagination from a total count, 24 per page.
  - Recipe pages at `/recipes/[slug]`: the source, the dates added and edited, times and yield, the cover photo, ingredients, steps, notes, and print styles.
- **Images:**
  - The `ImageStore` port and `BlobImageStore` on the private store, authenticating with OIDC.
  - `RecipeImageService`: dish photos and image content types only; scans are refused until Session 5.
  - `/api/images/[...path]` with year-long immutable caching, and Vercel image optimization for dish photos.
- **Sharing:** per-recipe Open Graph images (title, source, and dish photo, versioned by `updatedAt`), `Recipe` JSON-LD, canonical URLs, `metadataBase`, `robots.ts`, and `noindex` until launch.
- **Domain and application:** the role-in-pathname rule with plain segments, the served image content types, `toIsoDuration`, `RecipeRepository.count()`, and `listRecipes` returning `{ recipes, total }`.
- **Seeding:**
  - Six synthetic recipes in `src/domain/recipe/samples/`, two of them new.
  - Four public-domain or CC0 photos, with their sources in `scripts/seed/photos/SOURCES.md`.
  - `pnpm db:seed`, which runs in preview builds and on demand locally.
- **Design reference:** `/design` renders the real recipe components from DTOs built with the application's mappers, plus a pagination demo. The duplicated sample recipe is gone.
- **Operations:** the Blob connection moved to OIDC and its read-write token was removed. `delete-branch-action` v3.2.1 is already the latest release.

Deferred, each to the session that needs it:

- **Session 4:** resolved there.
  - Sorting for the list and search.
  - The canonical URL for `/?page=1`.
  - The `RecipePagination` demo.
  - `'use cache: remote'`: not needed yet. Session 8 revisits it if Neon's compute-hours climb.
- **Session 5:**
  - Before the `contributor_id` foreign key, choose one: a placeholder member row for the seed member `00000000-0000-4000-8000-000000000001` in non-production branches, or reassigning seeded recipes and resetting `develop`.
  - "Added by <display name>" on recipe pages, and `author` in the JSON-LD.
  - The members-only branch of the image route for scans: served unoptimized, never cached publicly.
- **Session 6:**
  - Uploads write under `dish/<environment>/` and `scan/<environment>/`, with pathnames in the domain's plain-segment shape. Deletes refuse other environments' prefixes.
  - Client uploads under OIDC use `handleUploadPresigned` (`handleUpload` needs a read-write token), restricted to `recipeImageContentTypes`.
  - Open Graph images draw only JPEG or PNG. Either make a JPEG derivative at upload, with `sharp` as a direct dependency, or restrict upload types.
  - Record image dimensions at upload if a screen shows a photo at its natural shape, and show more than the cover photo.
  - Server Actions invalidate `recipes` and `recipe:<slug>` with `updateTag`.
  - A recipe without a description publishes no meta or Open Graph description; consider a fallback with the form.
  - The Open Graph image caches its photo by pathname with `cacheLife('max')`, a missing photo included. Upload before saving the recipe so a card never caches the no-photo layout for a pathname that later exists.
- **Session 8:**
  - `sitemap.ts` and the `sitemap` line in `robots.ts`, when noindex comes off.
  - Open Graph caching:
    - Consider explicit immutable headers through `ImageResponse`'s `headers`, since the URLs are versioned. The cost: a deleted recipe's card lingers on the CDN unless purged.
    - Downscale the embedded photo; photo cards are 770 to 955 KB.
  - Unknown slugs and invalid pages return the not-found page with status 200 and `noindex`. Revisit with a proxy existence check if real 404s matter.
    - The server's HTML holds only the skeleton; the not-found UI arrives in the streamed payload, so clients without JavaScript see the skeleton alone.
    - An invalid list page keeps the title "Recipe Hub"; an unknown slug gets "Page not found".
  - Rich Results Test: recipes without a photo cannot qualify, and `recipeYield` is text ("Serves 8") where Google prefers a number for servings.
  - Check that Flat Rate CDN is on in Billing.
- **Operations:** `neondatabase/delete-branch-action` v3.2.1 is the latest release, a composite action. The Node 20 warning comes from the `setup-node@v4` it pins. Revisit when Neon updates it, or replace it with a `neonctl` step.
- **Known quirks:**
  - shadcn's `PaginationEllipsis` puts `aria-hidden` on the span holding its "More pages" text, so the text is never announced. The page links carry their own labels.
  - `components.json` points `utils` at `@/lib/utils`, which does not exist. The CLI still writes `import { cn } from 'cn'`.
  - Satori: `lineClamp` works only with `display: 'block'`, and adjacent JSX text children throw (use a template string).
  - Cards in the first row load eagerly. On tall screens a photo in the second row can be the largest paint, which is accepted.

### Session 4: Search (done 2026-10-11)

**Goal:** fast, forgiving, filterable search.

**Depends on:** Session 3 (browse UI).

**Delivers:**

- Search storage: a generated, weighted `tsvector` column, GIN indexes, `pg_trgm`, and `unaccent` (wrapped in an immutable function so generated columns can use it), all as migrations.
- `SearchService` with query parsing, filters, facets, ranking, highlighted snippets, and pagination, public like browsing.
- Search UI: a global search bar and a results page with filters, URL state, and empty and no-result states.
- A seeded synthetic corpus with expected-result tests.
- Rate limiting on the public search endpoint if it is not fully cached.

**Forks:** Postgres full-text search alone, `lakebase_text` BM25, or hybrid with `pgvector` (embeddings revisited after Session 7); the facet set.

**Done when:** misspellings, ingredient combinations, exclusions, and source filters return the expected results quickly on the seeded corpus.

Delivered:

- **Storage:** two migrations.
  - A custom one creates `pg_trgm`, `unaccent`, the immutable helpers (`immutable_unaccent`, `immutable_array_to_string`, `search_key`, `search_keys`), and the `recipe_english` configuration.
  - A generated one adds the six search columns of section 5.1, with GIN indexes on `search_vector` and `tag_keys`.
  - Recipe reads select the original columns only.
- **Application:**
  - The `RecipeSearch` port.
  - `RecipeSearchService`, which validates public input (`recipe.invalid-search`) and parses text for close matches the way `websearch_to_tsquery` does, reading curly quotes as quotes.
  - Sort on `listRecipes`, and the shared `paginationSchema` in `src/application/pagination.ts`.
- **Infrastructure:**
  - `DrizzleRecipeSearch`: exact and close matches, filters, facets, three sorts, and highlights for the page's rows, split into text segments.
  - One definition of each order (`recipe-order.ts`).
  - `findTagLabels` narrowed through the tag-key index.
- **Presentation:**
  - `/search`, and the header search.
  - Sort and a canonical URL on `/`.
  - `RecipePagination` with `pageHref`, and the shared recipe summary pieces, with card and row links named by their titles.
  - `input-group`, the highlight tokens, and `/design` demos: the search bar, results, loading, no results, and recipe pagination.
- **Corpus and tests:**
  - 30 synthetic samples, seeded on previews.
  - Expected-result tests over all of them: misspellings, ingredient combinations, exclusions, phrases, `or`, partial words, accents both ways, source, tag, and time filters, facets, and A to Z.
  - Tests that the generated columns agree with `totalMinutes` and `tagKey`, and tests of the parser, the service, and the URL helpers.
- **Fix:** dish photos load on deployments. Since Session 3 the image route had refused the optimizer's fetches over a query parameter the optimizer adds.
- **Speed:** in PGlite, a full search takes 2 to 8 ms over 2,000 recipes. The close-match query, run only when nothing matches exactly, takes 35 to 45 ms there.

Deferred, each to the session that needs it:

- **Session 5:**
  - The contributor filter, once display names exist, counted like sources.
  - The header has room for one more 36 px control at 390 px, but not at 360 or 375. The next one brings the mobile menu deferred from Session 1.
  - Rate-limit the access-request form. Either add a second WAF rule on the form's POST (the CLI's `server_action` condition), or call `checkRateLimit` from `@vercel/firewall` in the Server Action, which lets the form show an inline error.
    - `checkRateLimit` fails open on an unknown rule id, does nothing in development, and needs Protection Bypass for Automation on previews.
    - Call BotID's `checkBotId()` first.
- **Session 6:**
  - Strip C0 control characters in the domain's text schema. Highlights mark matches with `\u0002` and `\u0003`, so those characters in a recipe would misplace its highlights (never markup). Session 7's imports make them likelier.
  - Link recipe-page tags to `/search?tag=...` for browsing by tag. Cards cannot, because the whole card is a link.
- **Session 8:**
  - **Pending feedback while a search loads.** `useFormStatus` never reports pending for `next/form` in the App Router, so the old results stay until the new ones arrive. If Neon's wake-up makes the wait noticeable, dim the results with the `data-pending` pattern in the bundled `interactive-apps.md`.
  - **Neon compute-hours.** Watch them, and consider `'use cache: remote'` for list reads if they climb. Check whether an idle pooled connection keeps the compute awake.
  - **Close matches.** "chick" also reaches black bean chili and chocolate chip cookies at 0.5; a cutoff relative to the best score would drop them. Consider "Did you mean" corrections from a words list, and BM25 with `lakebase_text` once it matures.
  - **Phone filters.** The disclosure stays open after "Apply filters", with focus on the button. Revisit with real use.
  - **Accessibility audit:**
    - Card titles are not headings.
    - After a client-side page change, focus stays on the clicked page link while the page scrolls to the top.
  - **Indexing.** Search pages keep `noindex` when indexing turns on.
  - **Image route cache bypass.** Any request can add `_vercel_system` to skip the CDN cache, costing a function run and a Blob read. Consider a WAF rate limit on `/api/images`, keyed so the optimizer's own fetches are not throttled.
  - **`/design` navigation.** The Compositions section has no in-section navigation and now holds about ten subsections.
- **Known quirks:**
  - **`next/form` prefetch.** Its docs list `prefetch` as a boolean defaulting to true, but the source accepts only `false` or `null`, and it prefetches only the shell.
  - **Soft 404 in development.** It emits two robots meta tags: the root's and the injected `noindex`.
  - **`ts_debug`.** It shows `unaccent`'s output capitalized, so it is unreliable for checking `recipe_english`.
  - **drizzle-kit.** Its `out` must be relative to the working directory, and `--custom` rewrites the previous snapshot with its keys reordered.
  - **The close-match parser.** It takes words as runs of letters and numbers, so a script whose vowel signs never combine into one character (Devanagari) would split mid-word.
  - **Vercel docs.** They disagree on the Runtime Cache's tags per item (128 or 64) and on the Pro rate-limit window cap (10 minutes or 3,600 seconds).
  - **Vercel's image optimizer.** It fetches a local source with an undocumented `_vercel_system` query parameter, and request logs omit query strings, so the route's refusal warning is the way to see it.
  - **Source counts with close matches.** In close-match mode, source counts use close matching, but choosing a source that has exact matches shows those instead, so a count can differ from the results it leads to.

### Session 5: Authentication and contributor access

**Goal:** approved members can sign in to contribute, and the admin reviews requests easily.

**Depends on:** Session 1 (account pages), Session 2 (database and layers).

**Delivers:**

- Better Auth with the Drizzle adapter, sessions in Postgres, the `nextCookies` plugin, database-backed rate limiting, and the handler route.
- Passkeys through Better Auth's passkey plugin and email one-time codes through its email OTP plugin, with accounts created only by accepting an invite (section 5.4).
- The member model with `member` and `admin` roles, the access-request model, single-use hashed expiring invites, and application-layer authorization replacing Session 2's placeholder, including members-only scan delivery.
- A public request form protected by Vercel BotID and a rate limit, an `EmailSender` port with a Resend adapter, and request notifications.
- An admin page for requests (pending count, approve or deny through Server Actions, issue an invite to copy or email) and for members.
- Account pages: request access, accept an invite, sign in, and a privacy page covering what requests and accounts store.
- The optimistic gate in `proxy.ts` for the contribute and admin routes.
- Scripts that create the first admin's invite and mint invites against a preview's Neon branch.

**Forks:**

- **One-click links in notifications.** Recommendation: none; the email links to the request page.
- **Request form fields and invite lifetime.**

**Owner actions:** create a Resend account, add its SPF and DKIM records for a sending domain in Route 53, and store the API key in Vercel; be the first admin.

**Done when:** the owner registers a passkey on production through an invite, a member signs in with an email code, a request can be submitted, reviewed, and turned into an invite, and contribute routes refuse anonymous visitors.

### Session 6: Recipe authoring

**Goal:** members create, edit, and delete recipes with photos.

**Depends on:** Session 3 (pages and image store), Session 5 (members).

**Delivers:**

- The recipe form for create and edit, following section 6.3: list inputs for ingredients and steps with sections, tags, source, times, and yield, validated by the domain schema and built to double as the import review form.
- Photo upload with the drop area and attachments, through Blob client uploads authorized in the token route, each image with a role.
- Edit and delete, allowed for the author and admins.
- Cache invalidation on every mutation.

**Forks:** form library (shadcn's field components with React Hook Form or TanStack Form); reordering list items (drag handle with keyboard support, or move buttons); image optimization for private blobs; whether servings scaling is in scope now.

**Done when:** a member creates, edits, views, and deletes a recipe with photos on a preview deployment, and services and form mapping are tested.

### Session 7: AI import from photos and URLs

**Goal:** photos and links become reviewed recipes.

**Depends on:** Session 6 (recipe form and uploads).

**Delivers:**

- The `RecipeExtractor` strategy: JSON-LD, AI text, and AI vision extractors, all producing `RecipeDraft`.
- URL import with SSRF-safe fetching and HTML cleanup; photo import with multiple images.
- AI SDK calls through the Gateway with structured output against the draft schema, streaming partial results into the review form if that improves the experience.
- Import UI: choose a mode, see progress, review in the recipe form, save with provenance.
- Guardrails: members only, per-member rate limits, size limits, a Gateway budget, and clear error states.
- An evaluation set of synthetic or public-domain recipe cards and pages with expected drafts, plus tests for the JSON-LD extractor.

**Forks:** model choice (check the current Gateway catalog for vision quality and cost); free tier or purchased credits; synchronous requests or background jobs; whether to keep raw AI output for audit.

**Owner actions:** try a few real recipe cards by hand (never committed); decide on Gateway credits.

**Done when:** a handwritten card photo and three different recipe sites each produce an accurate draft that saves after review.

### Session 8: Launch hardening and onboarding

**Goal:** the site is ready to share and members contribute in production.

**Depends on:** all earlier sessions.

**Delivers:**

- **Brand and sharing:**
  - A brand mark designed with the owner and the icon set from section 5.7: favicon, SVG icon with a dark variant, Apple touch icon, and manifest icons.
  - The web app manifest, and the site-wide Open Graph image with its Twitter card (`metadataBase` landed in Session 3).
  - Verification with Meta's Sharing Debugger and Google's Rich Results Test.
- **Tests and audits:**
  - Playwright end-to-end tests for browsing, search, the request and invite flow, manual entry, and import.
  - An accessibility audit: automated with axe, plus keyboard, VoiceOver, and TalkBack passes. Fixes follow.
  - A performance pass: Core Web Vitals, image sizing, caching.
  - A security review: authorization on every write and AI use case, public endpoints and their rate limits, BotID, upload limits, SSRF, and response headers.
- **Operations:** log review, an error alerting decision, a backup and restore approach for Neon (consider a periodic export), and a runbook in the README.
- **Launch decisions:** the indexing decision revisited, invites sent, and onboarding notes for members.

**Owner actions:** review the brand mark; send invites; announce the site.

**Done when:** members sign in and contribute on production, a shared recipe link previews correctly, and every item above is complete.

## 10. Owner action items

| Action | Needed by |
| --- | --- |
| Create a Resend account, add its sending-domain records in Route 53, and store the API key in Vercel | Session 5 |
| Be the first admin and register a passkey | Session 5 |
| Try real recipe cards by hand; decide on AI Gateway credits | Session 7 |
| Review the brand mark; send invites; announce the site | Session 8 |

## 11. Open questions and risks

- **Public exposure:** browsing is public, so recipes, sources, contributor names, and photos can be scraped or indexed. Mitigation: member-chosen display names, members-only scans, `noindex` until launch, and no contact details on public pages.
- **One Blob store for every environment:** preview and local code can write beside production's photos. Mitigation: environment prefixes, deletes limited to their own prefix (Session 6), and OIDC credentials instead of a long-lived token.
- **Passkey familiarity:** some relatives may not know passkeys, and recovery depends on the admin. Mitigation: email one-time codes as the fallback, plain onboarding notes, and new invites for new devices.
- **Sign-in on previews:** passkeys are bound to their domain. Mitigation: invites minted against each preview's Neon branch.
- **Spam requests:** the request form is public. Mitigation: BotID, rate limits, and requests that create no account.
- **Uncached public search:** every search reaches Neon, so a crawler sending unique queries could spend the monthly compute-hours. Mitigation: the WAF rate-limit rule on `/search`, which blocks before a function runs.
- **Free tiers:** Resend allows 100 emails a day, and Neon Free has storage, compute, and branch caps. Both are fine at this scale; revisit if usage grows. A preview fails to deploy at the branch cap, so the cleanup workflow must keep running.
- **Schema changes under live traffic:** builds migrate before the new deployment serves, and old deployments keep serving. Mitigation: expand-then-contract migrations.
- **Drizzle 1.0:** a later upgrade rewrites the migrations folder and the client setup. Mitigation: no APIs that 1.0 removes.
- **AI accuracy and cost:** handwritten cards vary widely. Mitigation: mandatory review, an evaluation set, budgets, and rate limits.
- **Cache Components with authentication:** session-derived UI must follow the bundled guide so one member's view is never cached for everyone.
- **Young primitives and stale theming:** Base UI is less than a year past 1.0, with open mobile screen-reader bugs, and next-themes has not shipped since March 2025. Mitigation: screen-reader passes in Session 8, and the Next.js guide's inline script if next-themes breaks.

## 12. Status

- [x] Session 0: Project setup
- [x] Session 1: Design system and app shell
- [x] Session 2: Architecture foundation, recipe domain, and data layer
- [x] Session 3: Public browsing
- [x] Session 4: Search
- [ ] Session 5: Authentication and contributor access
- [ ] Session 6: Recipe authoring
- [ ] Session 7: AI import from photos and URLs
- [ ] Session 8: Launch hardening and onboarding
