import { onTestFinished } from 'vitest';

// An action's result that arrives when the test resolves it, or as the test ends, passed or failed,
// with the one given here: React holds every later transition, a later test's among them, until a
// pending action settles.
export function heldResult<T>(atTestEnd: T): PromiseWithResolvers<T> {
	const held = Promise.withResolvers<T>();
	onTestFinished(() => held.resolve(atTestEnd));
	return held;
}
