import 'server-only';
import { inspect, type InspectOptionsStylized } from 'node:util';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { z } from 'zod';
import { withoutQueryParameters } from '@/lib/errors';

// What a failed query's cause tells an operator. Postgres's message, `detail`, and `where` can quote a
// value, and PGlite's cause repeats the parameters, so it keeps only the names of what failed.
const causeSchema = z.object({
	name: z.string().optional(),
	code: z.string().optional(),
	constraint: z.string().optional(),
	table: z.string().optional(),
	column: z.string().optional(),
});

// The query's SQL and what failed, as an error Node prints the usual way.
function printableQueryError(error: DrizzleQueryError): Error {
	const message = withoutQueryParameters(error.message);
	const cause = causeSchema.safeParse(error.cause);
	const printable = new Error(message, cause.success ? { cause: cause.data } : undefined);
	printable.stack = error.stack?.replace(error.message, message);
	return printable;
}

// Next prints the errors it catches (render errors, route handler throws, Better Auth's own queries)
// through console.error, which would show a failed query's parameters and its cause's `detail`.
export function printQueryErrorsWithoutParameters(): void {
	Object.defineProperties(DrizzleQueryError.prototype, {
		[inspect.custom]: {
			configurable: true,
			value(this: DrizzleQueryError, depth: number, options: InspectOptionsStylized): string {
				return inspect(printableQueryError(this), { ...options, depth });
			},
		},
		toString: {
			configurable: true,
			value(this: DrizzleQueryError): string {
				return printableQueryError(this).toString();
			},
		},
	});
}
