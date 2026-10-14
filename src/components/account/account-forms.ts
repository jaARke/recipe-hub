// The fields the account forms submit and their actions read. Each is named for the service input it
// fills, so a validation problem's path names its field.
export const accessRequestFieldNames = {
	name: 'name',
	relationship: 'relationship',
	email: 'email',
} as const;

export const profileFieldNames = {
	displayName: 'displayName',
} as const;

// Named for the auth endpoint's inputs.
export const passkeyFieldNames = {
	id: 'id',
	name: 'name',
} as const;

// Shown when a request can't be sent, whether a rate limit or a lost connection stopped it or
// BotID refused it, so a refused bot learns nothing.
export const requestAccessFailureMessage =
	'We couldn’t send your request. Wait a few minutes and try again.';
