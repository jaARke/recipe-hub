import 'server-only';

// What became of a task given to tryRun: it ran, with its result, or it was skipped, since another
// image move held the lock.
export type LockAttempt<T> = { status: 'ran'; result: T } | { status: 'skipped' };

// One image move runs at a time in each environment: an image sweep, or the removal of the images a
// recipe's edit or delete let go, followed by its sweep. Each step is safe to repeat, but two moves
// can interleave destructively: one copies an unused image to the trash and pauses, a save attaches
// the image, another move restores it and clears the trash copy, and the first then deletes the
// original.
export interface ImageMoveLock {
	// Waits for the lock up to the adapter's bound, then runs the task holding it and releases it on
	// every path, a task that throws included. Throws without running the task once the bound passes.
	run<T>(task: () => Promise<T>): Promise<T>;
	// Runs the task holding the lock and releases it on every path, a task that throws included.
	// Skips the task without waiting when another image move holds the lock.
	tryRun<T>(task: () => Promise<T>): Promise<LockAttempt<T>>;
}
