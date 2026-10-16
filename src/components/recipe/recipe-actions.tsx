'use client';

import { cn } from 'cn';
import {
	CookingPotIcon,
	EllipsisIcon,
	LinkIcon,
	PrinterIcon,
	ShareIcon,
	type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useHydrated } from '@/components/forms/use-hydrated';
import { recipeCookPath, recipePath } from '@/components/recipe/recipe-paths';
import { copyLink, hasShareSheet, shareLink } from '@/components/sharing/link-sharing';
import { Button, buttonVariants } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

// 44 px for a finger, as the image viewer's buttons are.
const actionSizeClassNames = {
	labelled: 'pointer-coarse:h-11',
	icon: 'pointer-coarse:size-11',
	menuItem: 'pointer-coarse:min-h-11',
} as const;

// The favorite toggle's box, wide enough for its label; the toggle fills it.
const favoriteBoxClassName = cn('h-9 w-28 *:size-full', actionSizeClassNames.labelled);

// A refused copy can be made from the address bar, since the link is the page's own address.
const copyByHand = 'Copy it from the address bar.';

// The recipe's link on the host the page is on, so a preview shares its own pages.
function recipeLink(slug: string): string {
	return new URL(recipePath(slug), location.origin).href;
}

function RecipeMenuItem({
	label,
	icon: Icon,
	onClick,
}: {
	label: string;
	icon: LucideIcon;
	onClick: () => void;
}) {
	return (
		<DropdownMenuItem className={actionSizeClassNames.menuItem} onClick={onClick}>
			<Icon aria-hidden="true" />
			{label}
		</DropdownMenuItem>
	);
}

// Share where the browser has a share sheet, since elsewhere it would only copy the link, then Copy
// link and Print. The menu opens toward the page's empty side rather than over the actions, and a
// printout leaves it out, since Print starts while it is still closing.
function RecipeMoreActions({
	slug,
	title,
	showsShare,
}: {
	slug: string;
	title: string;
	showsShare: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="icon"
						aria-label="More actions"
						className={actionSizeClassNames.icon}
					/>
				}
			>
				<EllipsisIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-48 print:hidden">
				{showsShare && (
					<RecipeMenuItem
						label="Share"
						icon={ShareIcon}
						onClick={() => shareLink({ title, url: recipeLink(slug) }, copyByHand)}
					/>
				)}
				<RecipeMenuItem
					label="Copy link"
					icon={LinkIcon}
					onClick={() => copyLink(recipeLink(slug), copyByHand)}
				/>
				<RecipeMenuItem label="Print" icon={PrinterIcon} onClick={() => window.print()} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Start cooking, then the favorite toggle when one is passed, then a menu of the rest. A printout
// shows the recipe's link in their place.
function RecipeActions({
	slug,
	title,
	favoriteToggle,
}: {
	slug: string;
	title: string;
	// It streams in behind its own boundary, so its box is reserved whenever it is passed and the
	// menu after it never moves; the toggle fills the box.
	favoriteToggle?: ReactNode;
}) {
	// The host is known only in the browser, and so is its share sheet, which the menu can ask about
	// since it opens only once hydrated.
	const hydrated = useHydrated();

	return (
		<>
			<div role="group" aria-label="Recipe actions" className="flex flex-wrap gap-2 print:hidden">
				<Link
					href={recipeCookPath(slug)}
					className={buttonVariants({ className: actionSizeClassNames.labelled })}
				>
					<CookingPotIcon data-icon="inline-start" aria-hidden="true" />
					Start cooking
				</Link>
				{favoriteToggle !== undefined && (
					<div className={favoriteBoxClassName}>{favoriteToggle}</div>
				)}
				<RecipeMoreActions slug={slug} title={title} showsShare={hydrated && hasShareSheet()} />
			</div>
			{hydrated && (
				<p className="hidden text-sm wrap-anywhere text-muted-foreground print:block">
					{recipeLink(slug)}
				</p>
			)}
		</>
	);
}

// The actions' row while the recipe loads, as tall as the row it holds the place of.
function RecipeActionsSkeleton() {
	return (
		<div className="flex gap-2">
			<Skeleton className={cn('h-9 w-32', actionSizeClassNames.labelled)} />
			<Skeleton className={favoriteBoxClassName} />
			<Skeleton className={cn('size-9', actionSizeClassNames.icon)} />
		</div>
	);
}

export { RecipeActions, RecipeActionsSkeleton };
