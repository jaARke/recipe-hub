import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';

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
