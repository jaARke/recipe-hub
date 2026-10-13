import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { authBasePath } from '@/lib/auth-paths';

// The one presentation module that imports Better Auth, for client components only. Its calls reach
// the auth endpoint over HTTP, where Better Auth applies its rate limits, at the page's own origin, so
// it works on every deployment's host.
export const authClient = createAuthClient({
	basePath: authBasePath,
	plugins: [emailOTPClient(), passkeyClient()],
});
