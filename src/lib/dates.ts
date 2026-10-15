import { settings } from '@/lib/settings';

const millisecondsPerHour = 60 * 60 * 1000;

const millisecondsPerDay = 24 * millisecondsPerHour;

const dateFormat = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeZone: settings.display.timeZone,
});

const dayAndTimeFormat = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZone: settings.display.timeZone,
});

const timeFormat = new Intl.DateTimeFormat('en-US', {
	hour: 'numeric',
	minute: '2-digit',
	timeZone: settings.display.timeZone,
});

// Such as October 12, 2026.
export function formatDate(date: Date): string {
	return dateFormat.format(date);
}

// Such as October 12 at 3:12 PM, for a moment in the last few weeks.
export function formatDayAndTime(date: Date): string {
	return dayAndTimeFormat.format(date);
}

// Such as 3:12 PM, for a moment earlier today.
export function formatTime(date: Date): string {
	return timeFormat.format(date);
}

// Lifetimes are set in days or hours, and dates count milliseconds.
export function daysInMilliseconds(days: number): number {
	return days * millisecondsPerDay;
}

export function hoursInMilliseconds(hours: number): number {
	return hours * millisecondsPerHour;
}
