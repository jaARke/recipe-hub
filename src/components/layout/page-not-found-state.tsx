import Link from 'next/link';
import { Mascot } from '@/components/brand/mascot';
import { PageContainer } from '@/components/layout/page-container';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';

// The heading, and the title of the not-found pages that show it.
const pageNotFoundTitle = 'Page not found';

// What a URL that names no page shows, whether a route matched it or not.
function PageNotFoundState() {
	return (
		<PageContainer width="wide" className="py-12 sm:py-16">
			<Empty>
				<EmptyHeader>
					<EmptyMedia>
						<Mascot size="xl" loading="eager" />
					</EmptyMedia>
					{/* EmptyTitle renders a div, so the role makes it this page's heading. */}
					<EmptyTitle role="heading" aria-level={1}>
						{pageNotFoundTitle}
					</EmptyTitle>
					<EmptyDescription>
						This page doesn’t exist. The link may be broken, or the page may have moved.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					{/* Base UI's Button must not render links, so the link takes the button's look directly. */}
					<Link href={recipeListPath} className={buttonVariants()}>
						Back to recipes
					</Link>
				</EmptyContent>
			</Empty>
		</PageContainer>
	);
}

export { PageNotFoundState, pageNotFoundTitle };
