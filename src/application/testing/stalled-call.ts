// A call to something that never answers. It rejects with the signal's reason once the signal
// aborts, as an adapter given the signal stops; without a signal it never settles.
export function stalledCall(signal?: AbortSignal): Promise<never> {
	return new Promise((_, reject) => {
		signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
	});
}
