// Moves focus to the element with this id and centers it on screen, so what sits above it, such as
// a field's label, shows too. False when no element has the id.
export function focusCentered(id: string): boolean {
	const element = document.getElementById(id);
	if (element === null) {
		return false;
	}
	element.focus({ preventScroll: true });
	element.scrollIntoView({ block: 'center' });
	return true;
}
