import { z } from 'zod';

// One shape for validation failures and draft problems, so the review form renders both alike.
export const recipeProblemSchema = z.object({
	// Dotted, such as ingredientSections.0.lines.2.item; empty when the problem is the whole recipe.
	path: z.string(),
	message: z.string(),
});
export type RecipeProblem = z.infer<typeof recipeProblemSchema>;

export function recipeProblemsFromZodError(error: z.ZodError): RecipeProblem[] {
	return error.issues.map((issue) => ({
		path: issue.path.map(String).join('.'),
		message: issue.message,
	}));
}
