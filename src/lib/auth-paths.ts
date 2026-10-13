// Where the Route Handler mounts Better Auth, and where its client calls it.
export const authBasePath = '/api/auth';

// Better Auth's route that emails a sign-in code, which BotID checks.
export const signInCodeRequestPath = `${authBasePath}/email-otp/send-verification-otp`;
