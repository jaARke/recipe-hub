import 'server-only';
import { AppError } from '@/lib/errors';

export class MemberNotFoundError extends AppError {
	readonly code = 'member.not-found';

	constructor() {
		super('Member was not found');
	}
}

// Another admin changed the member's role after the page loaded, so they already have this one.
export class MemberRoleConflictError extends AppError {
	readonly code = 'member.role-conflict';

	constructor() {
		super('Member already has the role');
	}
}

// Without an admin, no one could review requests or make another admin.
export class LastAdminError extends AppError {
	readonly code = 'member.last-admin';

	constructor() {
		super('Last admin cannot be removed');
	}
}
