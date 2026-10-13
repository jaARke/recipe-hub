import { checkBotId } from 'botid/server';
import { handleAuthRequest } from '@/composition/services';
import { signInCodeRequestPath } from '@/lib/auth-paths';
import { getLogger } from '@/lib/logger';

const logger = getLogger('auth');

// Every route the auth flows call is a GET or a POST.
export const GET = handleAuthRequest;

// BotID judges a code request first, since each one can spend an email; a bot gets the forms' usual
// failure message.
export async function POST(request: Request): Promise<Response> {
	if (new URL(request.url).pathname === signInCodeRequestPath && (await checkBotId()).isBot) {
		logger.warn('Sign-in code request refused as automated');
		return new Response(null, { status: 403 });
	}

	return handleAuthRequest(request);
}
