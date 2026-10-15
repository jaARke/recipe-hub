'use client';

import { useState } from 'react';
import { standIn } from '@/components/design-reference/stand-in-actions';
import { FavoriteToggle } from '@/components/favorites/favorite-toggle';

// The favorite toggle with a stand-in for its Server Action, which keeps the change as the page's
// refresh would; reloading clears it.
function SampleFavoriteToggle({ recipeId }: { recipeId: string }) {
	const [favorite, setFavorite] = useState(false);

	return (
		<FavoriteToggle
			recipeId={recipeId}
			favorite={favorite}
			setFavoriteAction={async (_recipeId, next) => {
				await standIn(null);
				setFavorite(next);
				return { status: 'success' };
			}}
		/>
	);
}

export { SampleFavoriteToggle };
