import { describe, expect, it } from 'vitest';
import { memberIdSchema } from '@/domain/member/member';
import {
	importDraftCutoff,
	recipeImportIdSchema,
	reviewableDraft,
	type ImportDraft,
	type RecipeImport,
} from '@/domain/recipe/recipe-import';

const now = new Date('2026-10-12T15:00:00Z');

const draft: ImportDraft = {
	content: { title: 'Lemon icebox pie' },
	problems: [{ path: 'ingredientSections', message: 'Check the crust ingredients.' }],
};

const urlImport: RecipeImport = {
	id: recipeImportIdSchema.parse('0199d8a0-7c4e-7b1a-9f00-2a7c1e4b5d6e'),
	memberId: memberIdSchema.parse('0199d8a0-7c4e-7b1a-9f00-2a7c1e4b5d6f'),
	mode: 'url',
	status: 'succeeded',
	sourceUrl: 'https://example.com/pie',
	aiModel: 'example/model',
	costUsd: 0.0042,
	draft,
	createdAt: new Date('2026-10-10T15:00:00Z'),
};

describe('importDraftCutoff', () => {
	it('is seven days before now', () => {
		expect(importDraftCutoff(now)).toEqual(new Date('2026-10-05T15:00:00Z'));
	});
});

describe('reviewableDraft', () => {
	it("gives a URL import's draft its source URL and model", () => {
		expect(reviewableDraft(urlImport, now)).toEqual({
			...draft,
			provenance: {
				entryMode: 'url',
				sourceUrl: 'https://example.com/pie',
				aiModel: 'example/model',
			},
		});
	});

	it("gives a photo import's draft its model, or none when no model read it", () => {
		const photoImport: RecipeImport = { ...urlImport, mode: 'photo', sourceUrl: undefined };

		expect(reviewableDraft(photoImport, now)?.provenance).toEqual({
			entryMode: 'photo',
			aiModel: 'example/model',
		});
		expect(reviewableDraft({ ...photoImport, aiModel: undefined }, now)?.provenance).toStrictEqual({
			entryMode: 'photo',
		});
	});

	it('keeps the draft reviewable through the moment it expires', () => {
		expect(
			reviewableDraft({ ...urlImport, createdAt: importDraftCutoff(now) }, now)
		).not.toBeNull();
		expect(
			reviewableDraft(
				{ ...urlImport, createdAt: new Date(importDraftCutoff(now).getTime() - 1) },
				now
			)
		).toBeNull();
	});

	it.each<[string, Partial<RecipeImport>]>([
		['still running', { status: 'running', draft: undefined }],
		['failed', { status: 'failed', draft: undefined, failure: 'import.failed' }],
		['saved as a recipe', { savedRecipeSlug: 'lemon-icebox-pie' }],
		['cleared', { draft: undefined, sourceUrl: undefined }],
		['without its source URL', { sourceUrl: undefined }],
	])('is null for an import %s', (_case, changes) => {
		expect(reviewableDraft({ ...urlImport, ...changes }, now)).toBeNull();
	});
});
