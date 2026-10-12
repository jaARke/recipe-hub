// An aria-describedby value from the ids of the descriptions that rendered, or none when none did.
export function describedBy(...ids: (string | false | undefined)[]): string | undefined {
	const rendered = ids.filter((id) => typeof id === 'string');
	return rendered.length > 0 ? rendered.join(' ') : undefined;
}
