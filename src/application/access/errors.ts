import 'server-only';
import { AppError } from '@/lib/errors';

// One error for an unknown, used, revoked, or expired link, or one bound to another address, so the
// page tells the holder nothing more.
export class InviteUnavailableError extends AppError {
	readonly code = 'access.invite-unavailable';

	constructor() {
		super('Invite is unavailable');
	}
}

export class InviteNotFoundError extends AppError {
	readonly code = 'access.invite-not-found';

	constructor() {
		super('Invite was not found');
	}
}

// Also thrown for a request that is no longer pending, because only pending requests can be acted on.
export class AccessRequestNotFoundError extends AppError {
	readonly code = 'access.request-not-found';

	constructor() {
		super('Access request was not found');
	}
}
