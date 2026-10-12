import { z } from 'zod';
import { AppError } from '@/lib/errors';

// One shape for validation failures and recipe draft problems, so a form renders both alike.
export const problemSchema = z.object({
	// Dotted, such as ingredientSections.0.lines.2.item; empty when the problem is the whole input.
	path: z.string(),
	message: z.string(),
});
export type Problem = z.infer<typeof problemSchema>;

// Input that failed validation. Each problem names its field, so a form shows it beside that field.
export abstract class InvalidInputError extends AppError {
	readonly problems: readonly Problem[];

	constructor(message: string, problems: readonly Problem[]) {
		super(message);
		this.problems = problems;
	}
}

export function problemsFromZodError(error: z.ZodError): Problem[] {
	return error.issues.map((issue) => ({
		path: issue.path.map(String).join('.'),
		message: issue.message,
	}));
}
