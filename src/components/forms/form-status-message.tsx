// A form's confirmation, such as "Saved." Always rendered, so screen readers announce the message when
// it appears, and out of the layout while empty. The explicit aria-live, which the role implies, keeps
// it announced while a Base UI popup hides everything else from screen readers.
function FormStatusMessage({ message }: { message: string | undefined }) {
	return (
		<p
			role="status"
			aria-live="polite"
			className={message === undefined ? 'sr-only' : 'text-sm text-muted-foreground'}
		>
			{message}
		</p>
	);
}

export { FormStatusMessage };
