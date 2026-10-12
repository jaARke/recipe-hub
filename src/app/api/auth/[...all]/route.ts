import { handleAuthRequest } from '@/composition/services';

// Every route the auth flows call is a GET or a POST.
export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
