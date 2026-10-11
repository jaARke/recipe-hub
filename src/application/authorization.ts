import 'server-only';
import type { Actor, MemberActor } from '@/application/ports/actor-provider';
import { AppError } from '@/lib/errors';

export class SignInRequiredError extends AppError {
	readonly code = 'access.sign-in-required';

	constructor() {
		super('Sign-in is required');
	}
}

export class ForbiddenError extends AppError {
	readonly code = 'access.forbidden';

	constructor() {
		super('Access is forbidden');
	}
}

export function requireMember(actor: Actor): MemberActor {
	if (actor.kind === 'anonymous') {
		throw new SignInRequiredError();
	}

	return actor;
}
