// ─── Structured JSON Logger ───────────────────────────────────
// Single-line JSON output, grep-friendly for docker logs.
// Format: { level, scope, event, message, meta, ts }

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogScope = 'api' | 'bot' | 'parser' | 'fallback' | 'db' | 'config';

export interface LogEntry {
  level: LogLevel;
  scope: LogScope;
  event: string;
  message: string;
  ts: string;
  request_id?: string;
  user_id?: string;
  latency_ms?: number;
  meta?: Record<string, unknown>;
}

function write(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

function log(
  level: LogLevel,
  scope: LogScope,
  event: string,
  message: string,
  extra?: Partial<Pick<LogEntry, 'request_id' | 'user_id' | 'latency_ms' | 'meta'>>,
): void {
  write({ level, scope, event, message, ts: new Date().toISOString(), ...extra });
}

export const logger = {
  info:  (scope: LogScope, event: string, message: string, extra?: Parameters<typeof log>[4]) => log('info',  scope, event, message, extra),
  warn:  (scope: LogScope, event: string, message: string, extra?: Parameters<typeof log>[4]) => log('warn',  scope, event, message, extra),
  error: (scope: LogScope, event: string, message: string, extra?: Parameters<typeof log>[4]) => log('error', scope, event, message, extra),
  debug: (scope: LogScope, event: string, message: string, extra?: Parameters<typeof log>[4]) => log('debug', scope, event, message, extra),
};
