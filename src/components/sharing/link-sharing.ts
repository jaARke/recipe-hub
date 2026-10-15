import { toast } from '@/components/ui/toast';

// A link and its page's name, as a share sheet shows them.
type SharedLink = {
	title: string;
	url: string;
};

// Copies a link and says so in a toast. Where the browser refuses, the toast says how to copy it by
// hand instead, which depends on where the link shows.
export async function copyLink(url: string, copyByHand: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(url);
		toast.add({ title: 'Link copied' });
	} catch {
		toast.add({ type: 'error', title: 'Couldn’t copy the link', description: copyByHand });
	}
}

// Whether the browser has a share sheet for shareLink to open, through the Web Share API, which
// desktop Firefox lacks.
export function hasShareSheet(): boolean {
	return 'share' in navigator;
}

// Opens the device's share sheet, or copies the link where the browser refuses to share it, since the
// reader asked for the link. A share the reader cancels ends there.
export async function shareLink(link: SharedLink, copyByHand: string): Promise<void> {
	try {
		await navigator.share(link);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return;
		}
		await copyLink(link.url, copyByHand);
	}
}
