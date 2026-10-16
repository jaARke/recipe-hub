import { daysInMilliseconds } from '@/lib/dates';
import { settings } from '@/lib/settings';

// Images removed before this time are deleted for good.
export function removedImageCutoff(now: Date): Date {
	return new Date(now.getTime() - daysInMilliseconds(settings.retention.removedImageLifetimeDays));
}

// Unused images uploaded before this time are removed.
export function unusedImageCutoff(now: Date): Date {
	return new Date(now.getTime() - daysInMilliseconds(settings.retention.unusedImageLifetimeDays));
}
