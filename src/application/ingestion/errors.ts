import 'server-only';
import { InvalidInputError, type Problem } from '@/domain/problem';
import { AppError } from '@/lib/errors';

// The site turned the request away, as sites that license their content or block bots do.
export class ImportPageRefusedError extends AppError {
	readonly code = 'import.page-refused';
	readonly status: number;

	constructor(status: number) {
		super('Page refused the import');
		this.status = status;
	}
}

export const pageUnavailableReasons = [
	'not-found',
	'unreachable',
	'timed-out',
	'not-html',
	'too-large',
	'not-public',
] as const;
export type PageUnavailableReason = (typeof pageUnavailableReasons)[number];

// Anything else that keeps a page from being read. The reason is for logs; members see one message.
export class ImportPageUnavailableError extends AppError {
	readonly code = 'import.page-unavailable';
	readonly reason: PageUnavailableReason;

	constructor(reason: PageUnavailableReason, options?: ErrorOptions) {
		super('Page could not be read', options);
		this.reason = reason;
	}
}

// The AI Gateway refused the call for credits or budget, so imports wait until it is topped up.
export class ImportPausedError extends AppError {
	readonly code = 'import.paused';

	constructor(options?: ErrorOptions) {
		super('Imports are paused', options);
	}
}

// A model call failed, timed out, or returned output that does not fit its schema.
export class ImportFailedError extends AppError {
	readonly code = 'import.failed';

	constructor(options?: ErrorOptions) {
		super('Import did not finish', options);
	}
}

// The import passed its time limit, so it stopped before the platform would end it unrecorded.
export class ImportTimedOutError extends AppError {
	readonly code = 'import.timed-out';

	constructor() {
		super('Import took too long');
	}
}

// A recipe was already saved from the import, as when two pages add its draft at once, so the form
// tells the member to import the recipe again.
export class ImportUnavailableError extends AppError {
	readonly code = 'import.unavailable';

	constructor() {
		super('Import is unavailable');
	}
}

// The page or photos hold neither an ingredient nor a step.
export class ImportNoRecipeError extends AppError {
	readonly code = 'import.no-recipe';

	constructor() {
		super('No recipe was found');
	}
}

// The member has started as many imports as a day allows.
export class ImportRateLimitedError extends AppError {
	readonly code = 'import.rate-limited';

	constructor() {
		super('Import limit was reached');
	}
}

// An address that is not a web page, or scans that are not stored uploads within the limits.
export class InvalidImportError extends InvalidInputError {
	readonly code = 'import.invalid';

	constructor(problems: readonly Problem[]) {
		super('Import input is invalid', problems);
	}
}
