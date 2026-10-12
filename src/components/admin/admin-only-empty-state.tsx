import { LockIcon } from 'lucide-react';
import Link from 'next/link';
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

// For a signed-in member who is not an admin.
function AdminOnlyEmptyState() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LockIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>This page is for admins</EmptyTitle>
				<EmptyDescription>
					Admins review access requests and invite people. Your account doesn&apos;t have admin
					access.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link href={recipeListPath} className={buttonVariants()}>
					Back to recipes
				</Link>
			</EmptyContent>
		</Empty>
	);
}

export { AdminOnlyEmptyState };
