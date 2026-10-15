import 'server-only';
import { AppError } from '@/lib/errors';

// A signed-out reader's device holds settings.favorites.maxPerDevice favorites already.
export class DeviceFavoritesFullError extends AppError {
	readonly code = 'favorite.device-full';

	constructor() {
		super('Device favorites are full');
	}
}
