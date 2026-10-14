// Base for expected failures. Each subclass declares a stable code that callers branch on and that
// presentation maps to a user-facing message; anything else reaching a boundary is unexpected.
export abstract class AppError extends Error {
	abstract readonly code: string;

	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
	}
}

// Drizzle's query errors end their message with the query's parameters, which can hold email
// addresses and other personal data.
const queryParametersSeparator = '\nparams: ';

// What a failed query's cause tells an operator. Postgres's message, `detail`, and `where` can quote a
// value, and PGlite's cause repeats the parameters, so only the names of what failed are kept.
const queryErrorCauseFields = ['name', 'code', 'constraint', 'table', 'column'] as const;

export type QueryErrorCause = Partial<Record<(typeof queryErrorCauseFields)[number], string>>;

// The text before any query parameters.
export function withoutQueryParameters(text: string): string {
	return text.split(queryParametersSeparator)[0] ?? '';
}

// A failed query: its message carries the query's parameters.
export function isQueryError(error: Error): boolean {
	return error.message.includes(queryParametersSeparator);
}

// The one view of a failed query's cause that logs and printed errors show; none when it is not an
// object.
export function queryErrorCause(error: Error): QueryErrorCause | undefined {
	const { cause } = error;
	if (typeof cause !== 'object' || cause === null) {
		return undefined;
	}

	const fields: QueryErrorCause = {};
	for (const field of queryErrorCauseFields) {
		const value: unknown = Reflect.get(cause, field);
		if (typeof value === 'string') {
			fields[field] = value;
		}
	}
	return fields;
}
