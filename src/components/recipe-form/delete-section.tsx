import type * as React from 'react';
import { FormActions } from '@/components/forms/form-actions';
import { readingPartWidthClassName } from '@/components/layout/page-container';
import { PageSection } from '@/components/layout/page-section';

// What the form can delete: the recipe being edited, or a draft it holds.
type DeletedSubject = 'recipe' | 'draft';

const deleteSections = {
	recipe: {
		id: 'delete-recipe',
		title: 'Delete recipe',
		description: 'Deleting the recipe also deletes its photos, and it can’t be undone.',
	},
	draft: {
		id: 'delete-draft',
		title: 'Delete draft',
		description: 'Deleting the draft also deletes the photos only it uses, and it can’t be undone.',
	},
} as const satisfies Record<DeletedSubject, { id: string; title: string; description: string }>;

// Deletes what the recipe form edits, as the section after it. A recipe's and a draft's share this
// one place, so they stay in step wherever it moves. The form beside the original widens the page;
// this section keeps reading width.
function DeleteSection({
	subject,
	children,
}: {
	subject: DeletedSubject;
	// The section's confirm dialog.
	children: React.ReactNode;
}) {
	const { id, title, description } = deleteSections[subject];
	return (
		<PageSection
			id={id}
			title={title}
			className={readingPartWidthClassName}
			description={description}
		>
			<FormActions>{children}</FormActions>
		</PageSection>
	);
}

export { DeleteSection };
