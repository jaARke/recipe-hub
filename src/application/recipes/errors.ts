import 'server-only';
import { AppError } from '@/lib/errors';

export class RecipeNotFoundError extends AppError {
	readonly code = 'recipe.not-found';

	constructor() {
		super('Recipe was not found');
	}
}

export class InvalidRecipePageError extends AppError {
	readonly code = 'recipe.invalid-page';

	constructor() {
		super('Recipe page is invalid');
	}
}
