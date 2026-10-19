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

// The owner keeps their account and their admin role, so the site always has an admin.
export class OwnerProtectedError extends AppError {
	readonly code = 'member.owner';

	constructor() {
		super('Owner cannot be removed or lose admin');
	}
}

// Only the owner takes away another admin's role or account, so no admin can lock out another.
export class OwnerOnlyError extends AppError {
	readonly code = 'member.owner-only';

	constructor() {
		super('Only the owner can remove another admin');
	}
}

// Removing their own account would sign the admin out for good, so the owner removes them.
export class SelfRemovalError extends AppError {
	readonly code = 'member.self-removal';

	constructor() {
		super('Admin cannot remove themselves');
	}
}
