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

// The text before any query parameters.
export function withoutQueryParameters(text: string): string {
	return text.split(queryParametersSeparator)[0] ?? '';
}

// The first error in the cause chain whose message carries query parameters.
export function findQueryError(error: unknown): Error | undefined {
	for (let current = error; current instanceof Error; current = current.cause) {
		if (current.message.includes(queryParametersSeparator)) {
			return current;
		}
	}
	return undefined;
}
