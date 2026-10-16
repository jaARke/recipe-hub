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

// Another page saved the draft after the form opened or last saved it, so saving again would undo
// that save.
export class SavedDraftEditConflictError extends AppError {
	readonly code = 'draft.edit-conflict';

	constructor() {
		super('Saved draft was changed after it was loaded');
	}
}
