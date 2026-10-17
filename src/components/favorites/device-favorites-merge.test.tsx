import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { DeviceFavoritesMerge } from '@/components/favorites/device-favorites-merge';
import { toast } from '@/components/ui/toast';

function mergeAdding(addedCount: number) {
	return vi.fn(async () => ({ status: 'success' as const, addedCount }));
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('DeviceFavoritesMerge', () => {
	// Strict Mode runs effects twice, as the dev server does.
	it('merges once and says how many favorites it added', async () => {
		const add = vi.spyOn(toast, 'add');
		const merge = mergeAdding(2);
		const element = (
			<StrictMode>
				<DeviceFavoritesMerge mergeAction={merge} />
			</StrictMode>
		);
		const { rerender } = await render(element);
		await rerender(element);

		await expect
			.poll(() => add)
			.toHaveBeenCalledWith({
				type: 'success',
				title: '2 favorites added to your account',
				description: 'Saved on this device while you were signed out.',
			});
		expect(merge).toHaveBeenCalledTimes(1);
	});

	it('says nothing when the account already had every favorite the device kept', async () => {
		const add = vi.spyOn(toast, 'add');
		const merge = mergeAdding(0);
		await render(<DeviceFavoritesMerge mergeAction={merge} />);

		await expect.poll(() => merge).toHaveResolvedTimes(1);
		expect(add).not.toHaveBeenCalled();
	});
});
