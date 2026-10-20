import 'server-only';
import { InvalidInputError, type Problem } from '@/domain/problem';
import { AppError } from '@/lib/errors';

// A draft naming an image it may not, as a recipe may not: each problem is at images.<index>.pathname.
export class InvalidSavedDraftError extends InvalidInputError {
	readonly code = 'draft.invalid';

	constructor(problems: readonly Problem[]) {
		super('Saved draft is invalid', problems);
	}
}

// Another page saved the draft after the form opened or last saved it, so saving again, or deleting
// it, would undo that save.
export class SavedDraftEditConflictError extends AppError {
	readonly code = 'draft.edit-conflict';

	constructor() {
		super('Saved draft was changed after it was loaded');
	}
}

// The draft a form names is no longer the member's: added to the cookbook or deleted on another page,
// so saving it or adding from it again would make a second copy without its import.
export class SavedDraftGoneError extends AppError {
	readonly code = 'draft.gone';

	constructor() {
		super('Saved draft is gone');
	}
}

// Another page saved the draft after this one showed it, so deleting it would take that save away.
export class SavedDraftDeleteConflictError extends AppError {
	readonly code = 'draft.delete-conflict';

	constructor() {
		super('Saved draft was changed after it was shown');
	}
}
