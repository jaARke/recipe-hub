import { InvalidInputError, type Problem } from '@/domain/problem';

export class InvalidAccessRequestError extends InvalidInputError {
	readonly code = 'access.invalid-request';

	constructor(problems: readonly Problem[]) {
		super('Access request is invalid', problems);
	}
}

export class InvalidInviteError extends InvalidInputError {
	readonly code = 'access.invalid-invite';

	constructor(problems: readonly Problem[]) {
		super('Invite is invalid', problems);
	}
}

export class InvalidEmailError extends InvalidInputError {
	readonly code = 'access.invalid-email';

	constructor(problems: readonly Problem[]) {
		super('Email address is invalid', problems);
	}
}

export class InvalidProfileError extends InvalidInputError {
	readonly code = 'member.invalid-profile';

	constructor(problems: readonly Problem[]) {
		super('Profile is invalid', problems);
	}
}
