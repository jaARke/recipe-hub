import { OctagonXIcon } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';

// A problem with the whole form, such as an expired link. The alert role announces it.
function FormErrorAlert({ message }: { message: string | undefined }) {
	if (message === undefined) {
		return null;
	}

	return (
		<Alert variant="destructive">
			<OctagonXIcon aria-hidden="true" />
			<AlertTitle>{message}</AlertTitle>
		</Alert>
	);
}

export { FormErrorAlert };
