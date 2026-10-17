import 'server-only';
import { inspect, type InspectOptionsStylized } from 'node:util';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { queryErrorCause, withoutQueryParameters } from '@/lib/errors';

// The query's SQL and what failed, as an error Node prints the usual way. The end-to-end suites
// report their failed queries as this too (e2e/support/develop-database.ts).
export function printableQueryError(error: DrizzleQueryError): Error {
	const message = withoutQueryParameters(error.message);
	const cause = queryErrorCause(error);
	const printable = new Error(message, cause === undefined ? undefined : { cause });
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
