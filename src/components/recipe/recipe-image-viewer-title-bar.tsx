import { XIcon } from 'lucide-react';
import type * as React from 'react';
import { imagePositionLabel } from '@/components/recipe/recipe-image-viewer-labels';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogTitle } from '@/components/ui/dialog';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';

// The viewer's title bar: its title and where you are, the controls the body brings, and Close. The
// loading state shows it too, so a stalled body can still be closed, and Close never moves.
function RecipeImageViewerTitleBar({
	role,
	title,
	index,
	count,
	closeRef,
	children,
}: {
	role: RecipeImageRole;
	title: string;
	index: number;
	count: number;
	closeRef?: React.Ref<HTMLButtonElement>;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-4">
			<div className="flex min-w-0 flex-1 flex-col gap-1 py-1 pl-2">
				<DialogTitle className="truncate text-base">{title}</DialogTitle>
				{count > 1 && (
					<p className="truncate text-sm text-muted-foreground">
						{imagePositionLabel(role, index, count)}
					</p>
				)}
			</div>
			{children}
			<DialogClose
				ref={closeRef}
				render={<Button variant="ghost" size="icon" className="pointer-coarse:size-11" />}
			>
				<XIcon aria-hidden="true" />
				<span className="sr-only">Close</span>
			</DialogClose>
		</div>
	);
}

export { RecipeImageViewerTitleBar };
