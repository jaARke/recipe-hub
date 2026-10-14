import type { Metadata } from 'next';
import Link from 'next/link';
import { Mascot } from '@/components/brand/mascot';
import { PageContainer } from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';

export const metadata: Metadata = {
	title: 'Page not found',
};

export default function NotFound() {
	return (
		<PageContainer width="wide" className="py-12 sm:py-16">
			<Empty>
				<EmptyHeader>
					<EmptyMedia>
						<Mascot size="xl" />
					</EmptyMedia>
					{/* EmptyTitle renders a div, so the role makes it this page's heading. */}
					<EmptyTitle role="heading" aria-level={1}>
						Page not found
					</EmptyTitle>
					<EmptyDescription>
						This page doesn’t exist. The link may be broken, or the page may have moved.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					{/* Base UI's Button must not render links, so the link takes the button's look directly. */}
					<Link href="/" className={buttonVariants()}>
						Back to recipes
					</Link>
				</EmptyContent>
			</Empty>
		</PageContainer>
	);
}
