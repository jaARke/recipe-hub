'use client';

import { Specimen } from '@/components/design-reference/reference-section';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

const undoToastId = 'design-reference-undo';

const toastExamples = [
	{
		label: 'Default',
		raise: () =>
			toast.add({ title: 'Link copied', description: 'Anyone who is signed in can open it.' }),
	},
	{
		label: 'Success',
		raise: () =>
			toast.add({
				type: 'success',
				title: 'Recipe saved',
				description: 'Buttermilk biscuits is now in the collection.',
			}),
	},
	{
		label: 'Info',
		raise: () =>
			toast.add({
				type: 'info',
				title: 'Reading the page…',
				description: "You'll check what's read before saving it.",
			}),
	},
	{
		label: 'Warning',
		raise: () =>
			toast.add({
				type: 'warning',
				title: 'Some steps need review',
				description: 'Check the highlighted steps before saving.',
			}),
	},
	{
		label: 'Error',
		raise: () =>
			toast.add({
				type: 'error',
				priority: 'high',
				title: 'Could not save the recipe',
				description: 'Check your connection and try again.',
			}),
	},
	{
		label: 'Loading, then success',
		raise: () =>
			toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
				loading: { title: 'Saving recipe' },
				success: { title: 'Recipe saved', description: 'Weeknight chicken soup is up to date.' },
				error: { title: 'Could not save the recipe' },
			}),
	},
	{
		label: 'With an action',
		// An action needs time to reach, so this toast stays until it is dismissed.
		raise: () =>
			toast.add({
				id: undoToastId,
				timeout: 0,
				title: 'Recipe deleted',
				description: 'Sunday pot roast left the collection.',
				actionProps: { children: 'Undo', onClick: () => toast.close(undoToastId) },
			}),
	},
] as const;

function ToastSpecimen() {
	return (
		<Specimen label="Each button raises one toast through the toast manager">
			<div className="flex flex-wrap gap-3">
				{toastExamples.map((example) => (
					<Button key={example.label} variant="outline" onClick={example.raise}>
						{example.label}
					</Button>
				))}
			</div>
		</Specimen>
	);
}

export { ToastSpecimen };
