'use client';

import { cn } from 'cn';
import { LinkIcon, PrinterIcon, ShareIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useHydrated } from '@/components/forms/use-hydrated';
import { recipePath } from '@/components/recipe/recipe-paths';
import { copyLink, hasShareSheet, shareLink } from '@/components/sharing/link-sharing';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 44 px for a finger, as the image viewer's buttons are.
const coarsePointerSizeClassName = 'pointer-coarse:size-11';

// A refused copy can be made from the address bar, since the link is the page's own address.
const copyByHand = 'Copy it from the address bar.';

// The recipe's link on the host the page is on, so a preview shares its own pages.
function recipeLink(slug: string): string {
	return new URL(recipePath(slug), location.origin).href;
}

// Icon-only, so the name is the button's label and, on desktop, its tooltip.
function RecipeActionButton({
	label,
	icon: Icon,
	onClick,
}: {
	label: string;
	icon: LucideIcon;
	onClick: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="outline"
						size="icon"
						aria-label={label}
						className={coarsePointerSizeClassName}
						onClick={onClick}
					/>
				}
			>
				<Icon aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

// Share, Copy link, and Print, after the favorite toggle when one is passed; Share only where the
// browser has a share sheet, since elsewhere it would only copy the link. A printout shows the
// recipe's link in their place.
function RecipeActions({
	slug,
	title,
	favoriteToggle,
}: {
	slug: string;
	title: string;
	// It streams in behind its own boundary, so its box is reserved whenever it is passed and the
	// buttons after it never move; the toggle fills the box.
	favoriteToggle?: ReactNode;
}) {
	// The host is known only in the browser, and so is its share sheet. Share renders until hydration,
	// so phones and Safari, which have one, never shift, and other browsers drop it once hydrated.
	const hydrated = useHydrated();
	const showsShare = !hydrated || hasShareSheet();

	return (
		<>
			<div role="group" aria-label="Recipe actions" className="flex flex-wrap gap-2 print:hidden">
				{favoriteToggle !== undefined && (
					<div className={cn('size-9 *:size-full', coarsePointerSizeClassName)}>
						{favoriteToggle}
					</div>
				)}
				{showsShare && (
					<RecipeActionButton
						label="Share"
						icon={ShareIcon}
						onClick={() => shareLink({ title, url: recipeLink(slug) }, copyByHand)}
					/>
				)}
				<RecipeActionButton
					label="Copy link"
					icon={LinkIcon}
					onClick={() => copyLink(recipeLink(slug), copyByHand)}
				/>
				<RecipeActionButton label="Print" icon={PrinterIcon} onClick={() => window.print()} />
			</div>
			{hydrated && (
				<p className="hidden text-sm wrap-anywhere text-muted-foreground print:block">
					{recipeLink(slug)}
				</p>
			)}
		</>
	);
}

export { RecipeActions };
