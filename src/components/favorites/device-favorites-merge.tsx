'use client';

import { unstable_rethrow } from 'next/navigation';
import * as React from 'react';
import type { MergedFavoritesDto } from '@/application/favorites/favorite-dtos';
import type { FormState } from '@/components/forms/form-state';
import { toast } from '@/components/ui/toast';

type DeviceFavoritesMergeProps = {
	// The mergeDeviceFavorites Server Action, which clears the device's favorites once it adds them.
	mergeAction: () => Promise<FormState<MergedFavoritesDto>>;
};

function addedFavoritesTitle(count: number): string {
	return count === 1
		? '1 favorite added to your account'
		: `${count} favorites added to your account`;
}

// Rendered where a member's page load finds favorites this device kept while they were signed out,
// such as the page signing in loads. It moves them into their account, once a page load, and a toast
// says how many it added. A merge that fails leaves them on the device for the next page load.
function DeviceFavoritesMerge({ mergeAction }: DeviceFavoritesMergeProps) {
	const merged = React.useRef(false);

	React.useEffect(() => {
		if (merged.current) {
			return;
		}
		merged.current = true;

		React.startTransition(async () => {
			let result: FormState<MergedFavoritesDto>;
			try {
				result = await mergeAction();
			} catch (error) {
				unstable_rethrow(error);
				return;
			}
			if (result.status === 'success' && result.addedCount > 0) {
				toast.add({
					type: 'success',
					title: addedFavoritesTitle(result.addedCount),
					description: 'Saved on this device while you were signed out.',
				});
			}
		});
	}, [mergeAction]);

	return null;
}

export { DeviceFavoritesMerge };
