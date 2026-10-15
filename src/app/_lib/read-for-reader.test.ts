import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { readForReader } from '@/app/_lib/read-for-reader';

const request = vi.hoisted(() => ({ wait: (): Promise<void> => Promise.resolve() }));

// Outside a request connection() throws, so each test says how the wait for the request settles.
vi.mock('next/server', () => ({ connection: () => request.wait() }));

describe('readForReader', () => {
	let log: Mock<(error: unknown) => void>;
	let failure: { log: (error: unknown) => void; fallback: string };

	beforeEach(() => {
		request.wait = () => Promise.resolve();
		log = vi.fn();
		failure = { log, fallback: 'no link' };
	});

	it('gives what the read gives', async () => {
		await expect(readForReader(async () => 'edit link', failure)).resolves.toBe('edit link');
		expect(log).not.toHaveBeenCalled();
	});

	it('falls back and logs the error when the read fails', async () => {
		const unavailable = new Error('Database unavailable');
		const read = async () => {
			throw unavailable;
		};

		await expect(readForReader(read, failure)).resolves.toBe('no link');
		expect(log).toHaveBeenCalledExactlyOnceWith(unavailable);
	});

	it('lets Next control-flow errors through', async () => {
		const read = async () => notFound();

		await expect(readForReader(read, failure)).rejects.toThrow();
		expect(log).not.toHaveBeenCalled();
	});

	it('leaves a render that ends before the request to Next', async () => {
		const ended = new DOMException('This operation was aborted', 'AbortError');
		request.wait = () => Promise.reject(ended);
		const read = vi.fn(async () => 'edit link');

		await expect(readForReader(read, failure)).rejects.toBe(ended);
		expect(read).not.toHaveBeenCalled();
		expect(log).not.toHaveBeenCalled();
	});

	it('falls back and logs when the read itself aborts', async () => {
		const aborted = new DOMException('This operation was aborted', 'AbortError');
		const read = async () => {
			throw aborted;
		};

		await expect(readForReader(read, failure)).resolves.toBe('no link');
		expect(log).toHaveBeenCalledExactlyOnceWith(aborted);
	});
});
