'use client';

import { unstable_rethrow } from 'next/navigation';
import * as React from 'react';
import type { MergedFavoritesDto } from '@/application/favorites/favorite-dtos';
import type { FormState } from '@/components/forms/form-state';
import type { HeaderMember } from '@/components/layout/header-member';
import { toast } from '@/components/ui/toast';

type DeviceFavoritesMergeProps = {
	member: Promise<HeaderMember | null>;
	// The mergeDeviceFavorites Server Action, which clears the device's favorites once it adds them.
	mergeAction: () => Promise<FormState<MergedFavoritesDto>>;
};

function addedFavoritesTitle(count: number): string {
	return count === 1
		? '1 favorite added to your account'
		: `${count} favorites added to your account`;
}

// Rendered on every page. Once a member is signed in, it moves the favorites this device kept while
// signed out into their account, once a page load, since signing in loads a new page, and a toast
// says how many it added. A merge that fails leaves them on the device for the next page load.
function DeviceFavoritesMerge({ member, mergeAction }: DeviceFavoritesMergeProps) {
	const signedIn = React.use(member) !== null;
	const merged = React.useRef(false);

	React.useEffect(() => {
		if (!signedIn || merged.current) {
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
	}, [signedIn, mergeAction]);

	return null;
}

export { DeviceFavoritesMerge };
