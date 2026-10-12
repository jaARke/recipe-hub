'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';
import { recipeSearchPath } from '@/components/recipe/recipe-paths';

// The search page has its own field, so the header's bar would be a second one there.
// Under Cache Components this suspends below unknown dynamic params, so it renders inside Suspense.
function HeaderSearch({ children }: { children: React.ReactNode }) {
	return usePathname() === recipeSearchPath ? null : children;
}

export { HeaderSearch };
