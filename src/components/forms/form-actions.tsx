import * as React from 'react';

type FormActionsProps = {
	// The row's buttons, the primary first.
	children: React.ReactNode;
	// What the last attempt said, such as "Saved.", or why the button waits.
	status?: React.ReactNode;
};

// The one row for a page's actions, a form's buttons or a section's lone button: at the fields' left
// edge, with its status to the buttons' right, wrapping below them when the row is full. On phones
// the buttons stack full width and the status follows them. Dialogs keep DialogFooter.
function FormActions({ children, status }: FormActionsProps) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
			{children}
			{status}
		</div>
	);
}

export { FormActions };
