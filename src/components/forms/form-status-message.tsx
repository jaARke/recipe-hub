// A form's confirmation, such as "Saved." Always rendered, so screen readers announce the message when
// it appears, and out of the layout while empty.
function FormStatusMessage({ message }: { message: string | undefined }) {
	return (
		<p
			role="status"
			className={message === undefined ? 'sr-only' : 'text-sm text-muted-foreground'}
		>
			{message}
		</p>
	);
}

export { FormStatusMessage };
