import 'server-only';
import { AppError } from '@/lib/errors';

export class MemberNotFoundError extends AppError {
	readonly code = 'member.not-found';

	constructor() {
		super('Member was not found');
	}
}
