import { describe, expect, it } from 'vitest';
import { AppError, queryErrorCause } from '@/lib/errors';

class SampleError extends AppError {
	readonly code = 'sample.failed';
}

describe('AppError', () => {
	it('names an error after its subclass', () => {
		expect(new SampleError('Failed').name).toBe('SampleError');
	});

	it('keeps the message and cause', () => {
		const cause = new Error('Root');
		const error = new SampleError('Failed', { cause });
		expect(error.message).toBe('Failed');
		expect(error.cause).toBe(cause);
	});
});

describe('queryErrorCause', () => {
	it("keeps only the names of what failed from Postgres's cause, whose text can quote a value", () => {
		const canary = 'secret-value-canary';
		const cause = Object.assign(new Error(`invalid input syntax for type uuid: "${canary}"`), {
			code: '22P02',
			detail: `Key (invite_id)=(${canary}) is not present.`,
			where: `unnamed portal parameter $1 = '${canary}'`,
			table: 'users',
		});

		expect(queryErrorCause(new Error('Failed query: select 1 where id = $1', { cause }))).toEqual({
			name: 'Error',
			code: '22P02',
			table: 'users',
		});
	});

	it.each([
		'Query read timeout',
		'timeout exceeded when trying to connect',
		'Connection terminated due to connection timeout',
	])("keeps the message of the driver's own cause, which has no code: %s", (message) => {
		const cause = new Error(message);

		expect(queryErrorCause(new Error('Failed query: select 1 where id = $1', { cause }))).toEqual({
			name: 'Error',
			message,
		});
	});
});
