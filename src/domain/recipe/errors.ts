import { InvalidInputError, type Problem } from '@/domain/problem';

export class InvalidRecipeError extends InvalidInputError {
	readonly code = 'recipe.invalid';

	constructor(problems: readonly Problem[]) {
		super('Recipe content is invalid', problems);
	}
}
