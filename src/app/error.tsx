'use client';

import { MainContent } from '@/components/layout/main-content';
import { PageErrorState } from '@/components/layout/page-error-state';

// Catches what the (site) error page cannot: a failure of the (site) layout itself, and a page
// outside it. Either way no main landmark is left for the skip link, so this brings its own.
export default function RootErrorPage({ retry }: { retry: () => void }) {
	return (
		<MainContent>
			<PageErrorState onRetry={retry} />
		</MainContent>
	);
}
