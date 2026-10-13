import 'server-only';

// Runs a task after the response is sent, keeping the request's function alive until it settles.
// The task handles its own failures, since nothing awaits it.
export type TaskScheduler = (task: () => Promise<void>) => void;
