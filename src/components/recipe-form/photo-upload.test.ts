import { describe, expect, it } from 'vitest';
import { newPhotoPathname } from '@/components/recipe-form/photo-upload';
import { recipeImageSchema } from '@/domain/recipe/recipe-image';

describe('newPhotoPathname', () => {
	it.each([
		['dish', 'dish/production/'],
		['scan', 'scan/development/'],
		['dish', 'dish/preview/session-6-authoring/'],
	] as const)('names a JPEG in a %s folder that the recipe accepts', (role, folder) => {
		const pathname = newPhotoPathname(folder);

		expect(pathname.startsWith(folder)).toBe(true);
		expect(pathname.slice(folder.length)).toMatch(
			/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.jpg$/
		);
		expect(recipeImageSchema.safeParse({ role, pathname }).success).toBe(true);
	});

	it('names each upload differently', () => {
		expect(newPhotoPathname('dish/development/')).not.toBe(newPhotoPathname('dish/development/'));
	});
});
