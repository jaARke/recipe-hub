import 'server-only';

// A null column is an optional domain field left out, not one set to undefined.
export function withoutNulls(row: object): Record<string, unknown> {
	return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null));
}
