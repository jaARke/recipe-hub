import { describe, expect, it } from 'vitest';
import { draftName } from '@/components/recipe-import/listed-drafts';

describe('draftName', () => {
	it('names a draft by its title, or as untitled until it has one', () => {
		expect(draftName('Lemon bars')).toBe('Lemon bars');
		expect(draftName(undefined)).toBe('Untitled recipe');
	});
});
