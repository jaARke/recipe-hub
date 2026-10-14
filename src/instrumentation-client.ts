import { initBotId } from 'botid/client/core';
import { requestAccessPath } from '@/components/auth/auth-paths';
import { signInCodeRequestPath } from '@/lib/auth-paths';

// Marks the request form's submissions and sign-in code requests for BotID, whose verdict the
// server reads first.
initBotId({
	protect: [
		{ path: requestAccessPath, method: 'POST' },
		{ path: signInCodeRequestPath, method: 'POST' },
	],
});
