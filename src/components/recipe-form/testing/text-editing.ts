import { userEvent, type Locator } from 'vitest/browser';

type TextControl = HTMLInputElement | HTMLTextAreaElement;

// The text field the locator finds, whose value and caret a test reads.
export function textControl(field: Locator): TextControl {
	const element = field.element();
	if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
		throw new Error(`${field.selector} is no text field.`);
	}
	return element;
}

// The platform's own shortcuts, ⌘Z and ⇧⌘Z on Apple's and Ctrl+Z and Ctrl+Shift+Z elsewhere, which
// the browser reports in navigator.platform.
export function pressUndo() {
	return userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
}

export function pressRedo() {
	return userEvent.keyboard('{ControlOrMeta>}{Shift>}Z{/Shift}{/ControlOrMeta}');
}

// The browser's own undo or redo, as from its Edit menu, which no test can open: the browser sends it
// to the field whose typing tops its page's stack, whichever has focus. False where it was cancelled.
export function sendHistoryInput(field: Locator, inputType: 'historyUndo' | 'historyRedo') {
	return field
		.element()
		.dispatchEvent(new InputEvent('beforeinput', { inputType, cancelable: true, bubbles: true }));
}

// Pastes the text over the focused field's selection from the clipboard, as the member does. It
// reaches the clipboard by the member's own copy, from a field of its own that is gone after.
export async function pasteText(text: string) {
	const field = document.activeElement;
	if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
		throw new Error('No text field has focus to paste into.');
	}
	const { selectionStart, selectionEnd } = field;
	await copyText(text);
	field.focus();
	field.setSelectionRange(selectionStart, selectionEnd);
	await userEvent.paste();
}

async function copyText(text: string) {
	const source = document.body.appendChild(document.createElement('textarea'));
	source.value = text;
	source.focus();
	source.select();
	try {
		await userEvent.copy();
	} finally {
		source.remove();
	}
}
