import { describe, expect, it } from 'vitest';
import { provenanceSchema } from '@/domain/recipe/provenance';

describe('provenanceSchema', () => {
	it('accepts each entry mode', () => {
		expect(provenanceSchema.safeParse({ entryMode: 'manual' }).success).toBe(true);
		expect(
			provenanceSchema.safeParse({
				entryMode: 'url',
				sourceUrl: 'https://example.com/recipes/biscuits',
				aiModel: 'example/model-1',
			}).success
		).toBe(true);
		expect(
			provenanceSchema.safeParse({ entryMode: 'photo', aiModel: 'example/model-1' }).success
		).toBe(true);
	});

	it('requires a source URL for a URL import', () => {
		const result = provenanceSchema.safeParse({ entryMode: 'url' });
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([['sourceUrl']]);
	});

	it('accepts only web addresses as the source URL', () => {
		expect(
			provenanceSchema.safeParse({ entryMode: 'url', sourceUrl: 'javascript:alert(1)' }).success
		).toBe(false);
	});

	it('refuses a source URL holding a NUL character, which Postgres cannot store', () => {
		const result = provenanceSchema.safeParse({
			entryMode: 'url',
			sourceUrl: 'https://example.com/recipes/\u0000biscuits',
		});
		expect(result.error?.issues.map((issue) => issue.message)).toEqual([
			'Enter a web address that starts with http:// or https://.',
		]);
	});
});
