// A fixed zone, because the server runs in UTC and an evening date would read as the next day.
const dateFormat = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeZone: 'America/New_York',
});

// Such as October 12, 2026.
export function formatDate(date: Date): string {
	return dateFormat.format(date);
}
