'use client';

import { EllipsisIcon, EyeIcon, Trash2Icon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useConfirmActionDialogOpener } from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';
import { DeleteDraftDialog } from '@/components/recipe-form/delete-draft-dialog';
import { DeleteRecipeDialog } from '@/components/recipe-form/delete-recipe-dialog';
import {
	useHeldDraft,
	useHeldDraftControls,
	useReleaseDraft,
} from '@/components/recipe-form/held-draft';
import { removeRecipeFormChanges } from '@/components/recipe-form/use-recipe-form-autosave';
import { recipeListPath, recipePath } from '@/components/recipe/recipe-paths';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Menus of what can be done to a recipe or a draft as a whole, each a ⋯ button at the end of what
// it acts on: an editing page's heading, or a row in the list of drafts. Delete confirms in a dialog;
// a recipe's, once confirmed, removes the member's unsaved changes kept in this browser with it.

// 44 px for a finger, as the recipe page's actions are.
const touchSizeClassNames = {
	trigger: 'pointer-coarse:size-11',
	item: 'pointer-coarse:min-h-11',
} as const;

type SubjectMenuProps = {
	// Names the button for what the menu acts on, such as "Recipe actions".
	label: string;
	// The button, which takes focus back as its dialog closes.
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	children: React.ReactNode;
};

// The menu opens toward the page, from the button at the end of the row.
function SubjectMenu({ label, triggerRef, children }: SubjectMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				ref={triggerRef}
				render={
					<Button
						variant="outline"
						size="icon"
						aria-label={label}
						className={touchSizeClassNames.trigger}
					/>
				}
			>
				<EllipsisIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function SubjectMenuItem({
	icon: Icon,
	children,
	...props
}: Omit<React.ComponentProps<typeof DropdownMenuItem>, 'className'> & { icon: LucideIcon }) {
	return (
		<DropdownMenuItem className={touchSizeClassNames.item} {...props}>
			<Icon aria-hidden="true" />
			{children}
		</DropdownMenuItem>
	);
}

type DraftMenuProps = {
	// Names the button, as "Draft actions" beside a page's heading or with the draft's name in a list.
	label: string;
	draftId: string;
	// The recipe's title as saved, if it has one yet.
	title: string | undefined;
	// When the draft was last saved as the page shows it, so a delete never takes away a save made
	// since.
	savedAt: Date;
	// Deletes the draft; a list renders again without it, and a draft's page leaves.
	action: FormAction;
};

// Delete draft, for a draft open in the recipe form or listed among the member's drafts.
function DraftMenu({ label, draftId, title, savedAt, action }: DraftMenuProps) {
	const releaseDraft = useReleaseDraft();
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const opener = useConfirmActionDialogOpener(triggerRef);

	return (
		<>
			<SubjectMenu label={label} triggerRef={triggerRef}>
				<SubjectMenuItem
					variant="destructive"
					icon={Trash2Icon}
					onClick={() => opener.handle.open(null)}
				>
					Delete draft
				</SubjectMenuItem>
			</SubjectMenu>
			<DeleteDraftDialog
				draftId={draftId}
				title={title}
				savedAt={savedAt}
				opener={opener}
				action={action}
				// The page lets go of it if its form holds it, so its heading stops offering it.
				onDeleted={() => releaseDraft?.(draftId)}
			/>
		</>
	);
}

// A draft's page's menu once its form holds a saved draft, opened or just saved; a new recipe has
// none. The form deletes it once saving stops, and the page then leaves for the start page, which
// lists the drafts left.
function HeldDraftMenu({ action }: { action: FormAction }) {
	const draft = useHeldDraft();
	const controls = useHeldDraftControls();
	if (draft === undefined) {
		return null;
	}
	return (
		<DraftMenu
			label="Draft actions"
			draftId={draft.id}
			title={draft.title}
			savedAt={draft.savedAt}
			action={(state, formData) => (controls()?.deleting(action) ?? action)(state, formData)}
		/>
	);
}

// The edit page's menu: View recipe, then Delete recipe, which leaves for the list of recipes.
function EditedRecipeMenu({
	recipe,
	memberId,
	action,
}: {
	recipe: { id: string; slug: string; title: string };
	memberId: string;
	action: FormAction;
}) {
	const router = useRouter();
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const opener = useConfirmActionDialogOpener(triggerRef);

	return (
		<>
			<SubjectMenu label="Recipe actions" triggerRef={triggerRef}>
				<SubjectMenuItem icon={EyeIcon} render={<Link href={recipePath(recipe.slug)} />}>
					View recipe
				</SubjectMenuItem>
				<DropdownMenuSeparator />
				<SubjectMenuItem
					variant="destructive"
					icon={Trash2Icon}
					onClick={() => opener.handle.open(null)}
				>
					Delete recipe
				</SubjectMenuItem>
			</SubjectMenu>
			<DeleteRecipeDialog
				recipeId={recipe.id}
				title={recipe.title}
				opener={opener}
				action={action}
				onDeleted={() => {
					removeRecipeFormChanges(memberId, { kind: 'recipe', recipeId: recipe.id });
					// The edit page is gone, so the list takes its place in the history.
					router.replace(recipeListPath);
				}}
			/>
		</>
	);
}

export { DraftMenu, EditedRecipeMenu, HeldDraftMenu };
