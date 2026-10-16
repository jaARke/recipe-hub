'use client';

import { PageErrorState } from '@/components/layout/page-error-state';

export default function ErrorPage({ retry }: { retry: () => void }) {
	return <PageErrorState onRetry={retry} />;
}
