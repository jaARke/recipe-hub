import 'server-only';
import { AppError } from '@/lib/errors';

type LogLevel = 'info' | 'warn' | 'error';

// Values go in fields, never in the message; `err` takes an error and is serialized with its cause.
export type LogFields = Record<string, unknown> & { err?: unknown };

export type Logger = Record<LogLevel, (message: string, fields?: LogFields) => void>;

function serializeError(error: unknown): unknown {
	if (!(error instanceof Error)) {
		return error;
	}

	return {
		name: error.name,
		message: error.message,
		...(error instanceof AppError && { code: error.code }),
		stack: error.stack,
		...(error.cause !== undefined && { cause: serializeError(error.cause) }),
	};
}

function write(level: LogLevel, logger: string, message: string, fields: LogFields = {}) {
	const { err, ...rest } = fields;
	const record = {
		level,
		logger,
		message,
		...rest,
		...(err !== undefined && { err: serializeError(err) }),
	};

	// One JSON line per event. Vercel takes the level from the console method, not the JSON body.
	console[level](JSON.stringify(record));
}

export function getLogger(logger: string): Logger {
	return {
		info: (message, fields) => write('info', logger, message, fields),
		warn: (message, fields) => write('warn', logger, message, fields),
		error: (message, fields) => write('error', logger, message, fields),
	};
}
