import { act, render } from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceFavoritesMerge } from '@/components/favorites/device-favorites-merge';
import type { HeaderMember } from '@/components/layout/header-member';
import { toast } from '@/components/ui/toast';

const member: HeaderMember = { displayName: 'Sam', role: 'member' };

function mergeAdding(addedCount: number) {
	return vi.fn(async () => ({ status: 'success' as const, addedCount }));
}

// Lets the session read resolve and the merge it starts settle.
async function renderMerge(element: ReactElement) {
	const view = await act(async () => render(element));
	await act(async () => {});
	return view;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('DeviceFavoritesMerge', () => {
	// Strict Mode runs effects twice, as the dev server does.
	it('merges once for a member and says how many favorites it added', async () => {
		const add = vi.spyOn(toast, 'add');
		const merge = mergeAdding(2);
		const session = Promise.resolve(member);
		const element = (
			<StrictMode>
				<DeviceFavoritesMerge member={session} mergeAction={merge} />
			</StrictMode>
		);
		const { rerender } = await renderMerge(element);
		await act(async () => rerender(element));

		expect(merge).toHaveBeenCalledTimes(1);
		expect(add).toHaveBeenCalledWith({
			type: 'success',
			title: '2 favorites added to your account',
			description: 'Saved on this device while you were signed out.',
		});
	});

	it('says nothing when the device kept no favorites', async () => {
		const add = vi.spyOn(toast, 'add');
		const merge = mergeAdding(0);
		await renderMerge(
			<DeviceFavoritesMerge member={Promise.resolve(member)} mergeAction={merge} />
		);

		expect(merge).toHaveBeenCalledTimes(1);
		expect(add).not.toHaveBeenCalled();
	});

	it('leaves a signed-out reader’s favorites on the device', async () => {
		const merge = mergeAdding(1);
		await renderMerge(<DeviceFavoritesMerge member={Promise.resolve(null)} mergeAction={merge} />);

		expect(merge).not.toHaveBeenCalled();
	});
});
