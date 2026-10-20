'use client';

import * as React from 'react';
import { recipeAddedParamName } from '@/components/recipe/recipe-paths';
import { toast } from '@/components/ui/toast';
import { removeAddressParam } from '@/lib/url-query';

// Says the recipe was just added, on the page adding it lands on. The page is prerendered for every
// reader, so the address is read only in the browser, where its parameter goes as the toast shows: a
// reload, a return through history, or a copied link says nothing.
function RecipeAddedToast() {
	React.useEffect(() => {
		if (removeAddressParam(recipeAddedParamName)) {
			toast.add({
				type: 'success',
				title: 'Added to the cookbook',
				description: 'Everyone in the family can see it now.',
			});
		}
	}, []);

	return null;
}

export { RecipeAddedToast };
