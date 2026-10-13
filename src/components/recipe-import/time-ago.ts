const timeAgoFormat = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

const minuteMilliseconds = 60 * 1000;
const hourMilliseconds = 60 * minuteMilliseconds;
const dayMilliseconds = 24 * hourMilliseconds;

// Such as "5 minutes ago" or "yesterday", counting whole units, so the server renders it the same
// way for every visitor at that moment.
export function formatTimeAgo(date: Date, now: Date): string {
	const elapsed = now.getTime() - date.getTime();
	if (elapsed < minuteMilliseconds) {
		return 'just now';
	}
	if (elapsed < hourMilliseconds) {
		return timeAgoFormat.format(-Math.floor(elapsed / minuteMilliseconds), 'minute');
	}
	if (elapsed < dayMilliseconds) {
		return timeAgoFormat.format(-Math.floor(elapsed / hourMilliseconds), 'hour');
	}
	return timeAgoFormat.format(-Math.floor(elapsed / dayMilliseconds), 'day');
}
