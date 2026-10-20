// What the list of drafts, a draft's page, and the start page's notice call a draft: its title, until
// it has one.
export function draftName(title: string | undefined): string {
	return title ?? 'Untitled recipe';
}
