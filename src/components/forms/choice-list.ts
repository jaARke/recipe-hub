// Every choice's row, radio or checkbox: a 36 px tap with no gap between rows. A checkbox group's own
// gap is cleared, so both kinds of list keep one rhythm, in the recipe form and in Filter and sort.
export const choiceRowClassName = 'min-h-9 items-center';

export const choiceListClassName =
	'grid gap-x-6 gap-y-0 data-[slot=checkbox-group]:gap-x-6 data-[slot=checkbox-group]:gap-y-0';
