import { settings } from '@/lib/settings';

const millisecondsPerHour = 60 * 60 * 1000;

const millisecondsPerDay = 24 * millisecondsPerHour;

const dateFormat = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeZone: settings.display.timeZone,
});

// Such as October 12, 2026.
export function formatDate(date: Date): string {
	return dateFormat.format(date);
}

// Lifetimes are set in days or hours, and dates count milliseconds.
export function daysInMilliseconds(days: number): number {
	return days * millisecondsPerDay;
}

export function hoursInMilliseconds(hours: number): number {
	return hours * millisecondsPerHour;
}
