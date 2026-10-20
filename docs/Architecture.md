# Architecture

recipe-hub is a single Next.js app organized in layers, in the ports and adapters style. Dependencies point inward, toward the domain. dependency-cruiser enforces the boundaries: `pnpm lint:boundaries` fails when an import crosses one in the wrong direction, and its configuration gives the reason for each rule.

## Layers

- **Domain** (`src/domain`): the recipe and member model. It holds types, schemas, invariants, and pure functions like parsing, scaling, and formatting ingredient amounts. It does no I/O, reads no environment, and imports no framework, only the shared layer's pure helpers and a few pure libraries.
- **Application** (`src/application`): the use cases, written as services, and the ports they need from outside (storage, search, images, mail, the AI readers, and who is calling). Each use case decides who may call it and returns plain, serializable data, which makes this layer the app's data access layer. Public reads never ask who is calling, so they can be cached for everyone. It depends only on the domain and the shared layer.
- **Infrastructure** (`src/infrastructure`): the adapters that implement the ports. These are Postgres through Drizzle (with the schema and its migrations), Blob, the AI Gateway, guarded web fetching, Better Auth, Resend, and cookies. Each adapter turns vendor data and errors into the port's terms at the boundary.
- **Composition root** (`src/composition`): one module that builds the adapters from the validated environment and hands them to the services. It's the only code that knows which adapter backs which port.
- **Routes** (`src/app`): the pages, layouts, Server Actions, and route handlers. A route parses its input, calls a service from the composition root, and renders the result. It never imports an adapter. Anything only the signed-in member sees is read inside its own Suspense boundary, so the rest of the page stays shared.
- **Components** (`src/components`): UI that receives its data as props and never calls a service. The generated primitives (shadcn on Base UI) change only through the design tokens and their variants, and a deliberate change to one carries a comment saying why.
- **Shared** (`src/lib`): the validated environment, the logger, the product settings, and small helpers. It depends on no other layer.

The application, infrastructure, and composition layers are server-only, so none of their code can reach the browser. Some work has to start in the browser (passkey and code sign-in, BotID's check, and photo uploads straight to Blob), and for that, routes and components use the vendor's own library directly.

ESLint enforces two rules the boundaries can't. Only the shared environment module and entry points outside Next read the process environment, and every log message is a constant string with its values in fields.

## Where new code goes

- A rule about recipes or members goes in the domain, next to the type it governs.
- A new capability is a use case on an application service. Whatever it needs from outside is a port in the application layer, an adapter in infrastructure, and its wiring in the composition root.
- A page or endpoint is a route that calls a service, and the UI it needs is a component that takes props.
- A limit, lifetime, model choice, or other product policy is a setting in the shared layer, written next to its reason. The dev server, the tests, and the build all check every setting against its safe range when they start.
- A schema change is made in the schema and generated as a migration with `pnpm db:generate`. Extensions, functions, and text search configurations go in a custom migration (`pnpm db:generate --custom`), with a statement breakpoint after each statement. Every migration has to stay backward compatible, and [Operations](Operations.md#builds) explains why.
- Scripts and the end-to-end suites run outside Next, so each one is its own composition root and reads its own variables. dependency-cruiser only checks the app's source.
- Test kits, like in-memory fakes of the ports and a migrated in-process Postgres, sit next to the layer they serve, and only tests import them.
