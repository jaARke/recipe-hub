import { describe, expect, it } from 'vitest';
import journal from '@/infrastructure/db/migrations/meta/_journal.json';

// drizzle-kit 0.31 applies only migrations newer than the last one applied, and its check merely
// warns, so a migration merged out of timestamp order would be skipped silently.
describe('migration journal', () => {
	it('lists migrations in strictly increasing timestamp order', () => {
		const timestamps = journal.entries.map((entry) => entry.when);
		const ordered = [...new Set(timestamps)].sort((a, b) => a - b);
		expect(timestamps).toEqual(ordered);
	});
});
