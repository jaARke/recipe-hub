import { describe, expect, it } from 'vitest';
import { importProvenance } from '@/domain/recipe/recipe-import';

describe('importProvenance', () => {
	it("gives a link import's recipe the page's address, and its model when one read it", () => {
		const source = { mode: 'url', sourceUrl: 'https://example.com/pie' } as const;

		expect(importProvenance(source, 'example/model')).toEqual({
			entryMode: 'url',
			sourceUrl: 'https://example.com/pie',
			aiModel: 'example/model',
		});
		expect(importProvenance(source, undefined)).toStrictEqual({
			entryMode: 'url',
			sourceUrl: 'https://example.com/pie',
		});
	});

	it("gives a photo import's recipe its model, or none when no model read it", () => {
		expect(importProvenance({ mode: 'photo' }, 'example/model')).toEqual({
			entryMode: 'photo',
			aiModel: 'example/model',
		});
		expect(importProvenance({ mode: 'photo' }, undefined)).toStrictEqual({ entryMode: 'photo' });
	});
});
