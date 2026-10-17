# Architecture

Barb’s Table is one Next.js app arranged in layers, in the ports and adapters style. Dependencies point inward, toward the domain. dependency-cruiser holds the boundaries: `pnpm lint:boundaries` fails when an import crosses one the wrong way, and its configuration states each rule with its reason.

## Layers

- **Domain.** The recipe and member model: types, schemas, invariants, and pure functions such as parsing, scaling, and formatting ingredient amounts. It does no I/O, reads no environment, and imports no framework, only the shared layer's pure helpers and a few pure libraries.
- **Application.** The use cases, as services, and the ports they need from outside, such as storage, search, images, mail, the AI readers, and who is calling. Each use case decides who may call it and returns plain, serializable data, so this layer is the app's data access layer. Public reads never ask who is calling, which keeps them cacheable for everyone. It depends only on the domain and the shared layer.
- **Infrastructure.** The adapters that implement the ports: Postgres through Drizzle (with the schema and its migrations), Blob, the AI Gateway, guarded web fetching, Better Auth, Resend, and cookies. Each turns vendor data and errors into the port's terms at the boundary.
- **Composition root.** One module builds the adapters from the validated environment and hands them to the services. It is the only code that knows which adapter backs which port.
- **Routes.** The app's pages, layouts, Server Actions, and route handlers. They parse input, call a service from the composition root, and render the result, and never import an adapter. Whatever only the signed-in member sees is read inside its own Suspense boundary, so the page around it stays shared.
- **Components.** UI that receives its data as props and never calls a service. The generated primitives (shadcn on Base UI) change only through the design tokens and their variants, and a deliberate change to one carries a comment saying why.
- **Shared.** The validated environment, the logger, the product settings, and small helpers. It depends on no other layer.

The application, infrastructure, and composition layers are server-only, so none of their code can reach the browser. Where work has to start in the browser (passkey and code sign-in, BotID's check, and photo uploads straight to Blob), routes and components use the vendor's own library directly. ESLint holds two rules the boundaries cannot: only the shared environment module, and entry points outside Next, read the process environment, and every log message is a constant string with its values in fields.

## Where new code goes

- A rule about recipes or members goes in the domain, beside the type it governs.
- A new capability is a use case on an application service. What it needs from outside is a port in the application layer, an adapter in infrastructure, and its wiring in the composition root.
- A page or endpoint is a route that calls a service, and the UI it needs is a component that takes props.
- A limit, lifetime, model choice, or other product policy is a setting in the shared layer, written beside its reason. The dev server, the tests, and the build check every setting against its safe range as they start.
- A schema change is made in the schema and generated as a migration with `pnpm db:generate`. Extensions, functions, and text search configurations go in a custom migration (`pnpm db:generate --custom`), with a statement breakpoint after each statement. [Operations](Operations.md#builds) says why every migration stays backward compatible.
- Scripts and the end-to-end suites run outside Next, so each is its own composition root and reads its own variables. dependency-cruiser checks only the app's source.
- Test kits, such as in-memory fakes of the ports and a migrated in-process Postgres, sit beside the layer they serve, and only tests import them.
