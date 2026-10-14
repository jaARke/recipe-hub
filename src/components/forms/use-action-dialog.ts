'use client';

import { useRef, useState } from 'react';
import type { FormAction } from '@/components/forms/form-state';

// The open state of a dialog whose form runs an action, as props for its root, and the action for
// its form. The dialog closes once the action succeeds and stays open while it runs: its form
// unmounts with the popup, so a dialog closed and opened again mid-request could send the request
// twice, and the first answer would have nowhere to show.
export function useActionDialog(action: FormAction, onSuccess: () => void) {
	const [open, setOpen] = useState(false);
	const running = useRef(false);

	const runAction: FormAction = async (previous, formData) => {
		running.current = true;
		try {
			const next = await action(previous, formData);
			if (next.status === 'success') {
				setOpen(false);
				onSuccess();
			}
			return next;
		} finally {
			running.current = false;
		}
	};

	function changeOpen(nextOpen: boolean) {
		if (nextOpen || !running.current) {
			setOpen(nextOpen);
		}
	}

	return [{ open, onOpenChange: changeOpen }, runAction] as const;
}
