// Where the Route Handler mounts Better Auth, and where its client calls it.
export const authBasePath = '/api/auth';

// Better Auth's route that emails a sign-in code, which BotID checks.
export const signInCodeRequestPath = `${authBasePath}/email-otp/send-verification-otp`;

// The invite page, which every invite's link opens. The invite service builds the links, and the
// page's props are typed by this route, so moving the page fails to compile until this follows it.
export const invitePath = '/invite';
