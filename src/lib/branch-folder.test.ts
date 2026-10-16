import { describe, expect, it } from 'vitest';
import { branchFolder } from '@/lib/branch-folder';

// Each hash is the first 8 hex digits of the name's SHA-256, as `printf '%s' <name> | sha256sum` gives.
describe('branchFolder', () => {
	it('names a branch by its readable part and the hash of its exact name', () => {
		expect(branchFolder('feat/x')).toBe('feat-x-79b4cc55');
	});

	it('tells apart branches whose readable parts match', () => {
		expect(branchFolder('feat-x')).toBe('feat-x-5b66f324');
		expect(branchFolder('Feature/X')).toBe('feature-x-02cc1910');
	});

	it('makes each other run one hyphen and trims hyphens from the ends', () => {
		expect(branchFolder('--Fix__the..Bug--')).toBe('fix-the-bug-e83c66fa');
	});

	it('is the hash alone when nothing readable is left', () => {
		expect(branchFolder('日本')).toBe('cf2abf0c');
		expect(branchFolder('/')).toBe('8a5edab2');
	});

	it('keeps branches whose hashes match apart by their readable parts', () => {
		expect(branchFolder('review-branch-94325')).toBe('review-branch-94325-2481685f');
		expect(branchFolder('review-branch-143353')).toBe('review-branch-143353-2481685f');
	});
});
