import { adminFieldNames } from '@/components/admin/admin-forms';
import { TextField } from '@/components/forms/text-field';

// The new member's name, which both ways of inviting someone ask for.
function DisplayNameField({
	id,
	defaultValue,
	error,
}: {
	id: string;
	defaultValue?: string;
	error?: string;
}) {
	return (
		<TextField
			id={id}
			name={adminFieldNames.displayName}
			label="Name"
			description="Shown with the recipes they add. They can change it later."
			required
			autoComplete="off"
			defaultValue={defaultValue}
			error={error}
		/>
	);
}

export { DisplayNameField };
