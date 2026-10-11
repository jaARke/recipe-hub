import type { RecipeProblem } from '@/domain/recipe/recipe-problem';
import { AppError } from '@/lib/errors';

export class InvalidRecipeError extends AppError {
	readonly code = 'recipe.invalid';
	readonly problems: readonly RecipeProblem[];

	constructor(problems: readonly RecipeProblem[]) {
		super('Recipe content is invalid');
		this.problems = problems;
	}
}
