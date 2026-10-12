import 'server-only';
import { AppError } from '@/lib/errors';

export class InvalidRecipeSearchError extends AppError {
	readonly code = 'recipe.invalid-search';

	constructor() {
		super('Recipe search is invalid');
	}
}
