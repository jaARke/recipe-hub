// Shows a kept page again and says how each part of a popup its hiding closed displays as React
// reveals the page, read before Base UI's next frame unmounts the popup or completes its close.
export async function displayAsPageShows(
	parts: readonly Element[],
	show: () => Promise<void>
): Promise<string[]> {
	let displays: string[] = [];
	const observer = new MutationObserver(() => {
		displays = parts.map((part) => getComputedStyle(part).display);
		observer.disconnect();
	});
	observer.observe(document.body, { subtree: true, attributeFilter: ['style'] });
	try {
		await show();
	} finally {
		observer.disconnect();
	}
	return displays;
}
