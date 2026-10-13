// How long a removed photo or scan is kept before it is deleted for good: past the database's 35-day
// snapshots, so restoring a deleted recipe from one brings its images back.
export const removedImageLifetimeDays = 40;

// How long an upload that no recipe or import draft names is kept, so a recipe being written can still
// save it.
const unusedImageLifetimeDays = 1;

// How long an image in an expiring environment's folders, such as a preview's, is kept after it
// was uploaded or removed. Nothing says when a branch's previews are gone, so its images go by age.
const expiringImageLifetimeDays = 30;

// Images removed before this time are deleted for good.
export function removedImageCutoff(now: Date): Date {
	return new Date(now.getTime() - removedImageLifetimeDays * 24 * 60 * 60 * 1000);
}

// Unused images uploaded before this time are removed.
export function unusedImageCutoff(now: Date): Date {
	return new Date(now.getTime() - unusedImageLifetimeDays * 24 * 60 * 60 * 1000);
}

// Images in expiring environments' folders uploaded or removed before this time are deleted.
export function expiringImageCutoff(now: Date): Date {
	return new Date(now.getTime() - expiringImageLifetimeDays * 24 * 60 * 60 * 1000);
}
