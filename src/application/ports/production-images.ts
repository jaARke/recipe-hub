import 'server-only';
import type { StoredImage } from '@/application/ports/image-store';

// Production's dish photos and scans, as its public image route serves them to anyone.
export interface ProductionImages {
	// Returns null when production serves no image at this pathname. The read and its body stop once
	// the signal aborts.
	get(pathname: string, signal?: AbortSignal): Promise<StoredImage | null>;
}
