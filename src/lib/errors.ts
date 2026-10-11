// Base for expected failures. Each subclass declares a stable code that callers branch on and that
// presentation maps to a user-facing message; anything else reaching a boundary is unexpected.
export abstract class AppError extends Error {
	abstract readonly code: string;
}
