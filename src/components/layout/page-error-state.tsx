import { TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { Button, buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';

// What a page that failed to render shows in its place, whether or not the chrome surrounds it.
function PageErrorState({ onRetry }: { onRetry: () => void }) {
	return (
		<PageContainer width="wide" className="py-12 sm:py-16">
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<TriangleAlertIcon aria-hidden="true" />
					</EmptyMedia>
					{/* EmptyTitle renders a div, so the role makes it this page's heading. */}
					<EmptyTitle role="heading" aria-level={1}>
						Something went wrong
					</EmptyTitle>
					<EmptyDescription>
						This page couldn’t load. Try again, or go back to the recipes.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<div className="flex flex-wrap justify-center gap-2">
						<Button onClick={() => onRetry()}>Try again</Button>
						{/* Base UI's Button must not render links, so the link takes the button's look directly. */}
						<Link href={recipeListPath} className={buttonVariants({ variant: 'outline' })}>
							Back to recipes
						</Link>
					</div>
				</EmptyContent>
			</Empty>
		</PageContainer>
	);
}

export { PageErrorState };
