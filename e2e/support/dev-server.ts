// The dev server the suites drive: `pnpm dev` from this tree, on Neon's develop branch. Sessions are
// read only here, on Better Auth's allowed host, so a server on another port fails every member page.
export const devServerUrl = new URL('http://localhost:3000');
