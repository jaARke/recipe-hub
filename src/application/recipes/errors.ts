import 'server-only';
import { AppError } from '@/lib/errors';

export class RecipeNotFoundError extends AppError {
	readonly code = 'recipe.not-found';

	constructor() {
		super('Recipe was not found');
	}
}

// Someone saved the recipe after the editor loaded it, so saving again would undo their changes.
export class RecipeEditConflictError extends AppError {
	readonly code = 'recipe.edit-conflict';

	constructor() {
		super('Recipe was changed after it was loaded');
	}
}

export class InvalidRecipePageError extends AppError {
	readonly code = 'recipe.invalid-page';

	constructor() {
		super('Recipe page is invalid');
	}
}

// A pathname that is not a new upload in this environment's folders.
export class InvalidImageUploadError extends AppError {
	readonly code = 'image.invalid-upload';

	constructor() {
		super('Image upload is invalid');
	}
}
