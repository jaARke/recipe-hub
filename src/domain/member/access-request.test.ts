import { describe, expect, it } from 'vitest';
import {
	accessRequestFieldsSchema,
	parseAccessRequestFields,
} from '@/domain/member/access-request';
import { problemsFromZodError } from '@/domain/problem';

const fields = { name: 'Ada Lovelace', relationship: 'We met at the book club.' };

function problemPaths(input: unknown): string[] {
	const result = accessRequestFieldsSchema.safeParse(input);
	return result.success ? [] : problemsFromZodError(result.error).map(({ path }) => path);
}

describe('accessRequestFieldsSchema', () => {
	it('trims the fields and normalizes the optional email', () => {
		expect(
			accessRequestFieldsSchema.parse({
				name: ' Ada Lovelace ',
				relationship: ' We met at the book club. ',
				email: ' Ada@Example.com ',
			})
		).toEqual({ ...fields, email: 'ada@example.com' });
	});

	it('leaves the email out when none is given', () => {
		expect(accessRequestFieldsSchema.parse(fields)).toEqual(fields);
	});

	it('accepts a relationship of up to 500 characters', () => {
		expect(problemPaths({ ...fields, relationship: 'a'.repeat(500) })).toEqual([]);
		expect(problemPaths({ ...fields, relationship: 'a'.repeat(501) })).toEqual(['relationship']);
	});

	it('requires a name and a relationship', () => {
		expect(problemPaths({ name: ' ', relationship: '' })).toEqual(['name', 'relationship']);
		expect(problemPaths({})).toEqual(['name', 'relationship']);
	});

	it('strips a NUL character, which Postgres cannot store', () => {
		expect(accessRequestFieldsSchema.parse({ name: 'Ada', relationship: 'A\0 neighbor' })).toEqual({
			name: 'Ada',
			relationship: 'A neighbor',
		});
	});

	it('rejects an email that is not an address', () => {
		expect(problemPaths({ ...fields, email: 'ada' })).toEqual(['email']);
	});
});

describe('parseAccessRequestFields', () => {
	it('says what to enter in each blank field', () => {
		expect(() => parseAccessRequestFields({ name: ' ', relationship: '' })).toThrow(
			expect.objectContaining({
				problems: [
					{ path: 'name', message: 'Enter your name.' },
					{ path: 'relationship', message: 'Enter how you know us.' },
				],
			})
		);
	});

	it('reports every problem with its field path', () => {
		expect(() =>
			parseAccessRequestFields({ name: '', relationship: 'Neighbor', email: 'x' })
		).toThrow(
			expect.objectContaining({
				code: 'access.invalid-request',
				problems: [
					{ path: 'name', message: expect.any(String) },
					{ path: 'email', message: expect.any(String) },
				],
			})
		);
	});
});
