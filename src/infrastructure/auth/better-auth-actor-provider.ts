import 'server-only';
import type { Actor, ActorProvider } from '@/application/ports/actor-provider';
import { memberIdSchema, memberRoleSchema } from '@/domain/member/member';
import type { Auth } from '@/infrastructure/auth/better-auth';

// Server Components cannot set cookies, so reads never renew the session; the browser's own
// session requests renew it.
export class BetterAuthActorProvider implements ActorProvider {
	private readonly auth: () => Auth;
	private readonly requestHeaders: () => Promise<Headers>;

	// Takes Better Auth through a function, so it is built only when a request first asks.
	constructor(auth: () => Auth, requestHeaders: () => Promise<Headers>) {
		this.auth = auth;
		this.requestHeaders = requestHeaders;
	}

	async currentActor(): Promise<Actor> {
		// Read first: prerendering stops at the request, before building Better Auth reads the clock.
		const requestHeaders = await this.requestHeaders();
		const session = await this.auth().api.getSession({
			headers: requestHeaders,
			query: { disableRefresh: true },
		});
		if (session === null) {
			return { kind: 'anonymous' };
		}

		return {
			kind: 'member',
			memberId: memberIdSchema.parse(session.user.id),
			role: memberRoleSchema.parse(session.user.role),
		};
	}
}
