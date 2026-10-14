'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { FormState } from '@/components/forms/form-state';

// A field marked invalid, or a group's own error, which takes focus in place of a field.
const invalidSelector = '[aria-invalid="true"], [data-slot="field-error"][tabindex="-1"]';

// After each failed result, moves focus to the problem: the element with alertId, or else the
// form's first invalid field. Each result moves it once, not again when a hidden page shows, so it
// takes the action's own result from useFormAction rather than the state the form shows.
export function useFocusOnFailure<Success extends object>(
	result: FormState<Success>,
	formRef: RefObject<HTMLFormElement | null>,
	alertId: string
) {
	const focusedResult = useRef(result);

	useEffect(() => {
		if (focusedResult.current === result) {
			return;
		}
		focusedResult.current = result;
		if (result.status !== 'error') {
			return;
		}
		const target =
			document.getElementById(alertId) ??
			formRef.current?.querySelector<HTMLElement>(invalidSelector);
		target?.focus();
	}, [result, formRef, alertId]);
}
