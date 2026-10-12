import { initBotId } from 'botid/client/core';
import { requestAccessPath } from '@/components/auth/auth-paths';

// Marks the request form's submissions for BotID, whose verdict its Server Action reads first.
initBotId({ protect: [{ path: requestAccessPath, method: 'POST' }] });
