import { settings } from '@/lib/settings';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const dateFormat = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeZone: settings.display.timeZone,
});

// Such as October 12, 2026.
export function formatDate(date: Date): string {
	return dateFormat.format(date);
}

// Lifetimes are set in days, and dates count milliseconds.
export function daysInMilliseconds(days: number): number {
	return days * millisecondsPerDay;
}
