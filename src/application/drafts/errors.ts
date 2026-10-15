import 'server-only';
import { InvalidInputError, type Problem } from '@/domain/problem';

// A draft naming an image it may not, as a recipe may not: each problem is at images.<index>.pathname.
export class InvalidSavedDraftError extends InvalidInputError {
	readonly code = 'draft.invalid';

	constructor(problems: readonly Problem[]) {
		super('Saved draft is invalid', problems);
	}
}
