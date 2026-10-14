import { OctagonXIcon } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';

// A problem with the whole form, such as an expired link. The alert role announces it, and it takes
// focus after a failed submit when it comes first among the form's problems (useFormAction).
// useFormAction and useTransientState hold an attempt's message only while its page is shown.
function FormErrorAlert({ message }: { message: string | undefined }) {
	if (message === undefined) {
		return null;
	}

	return (
		<Alert variant="destructive" tabIndex={-1}>
			<OctagonXIcon aria-hidden="true" />
			<AlertTitle>{message}</AlertTitle>
		</Alert>
	);
}

export { FormErrorAlert };
