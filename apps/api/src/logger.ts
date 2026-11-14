import { env } from "./env";

const LEVELS = { debug: 10, info: 20, error: 30 } as const;
type Level = keyof typeof LEVELS;

function write(level: Level, message: string, fields: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[env.LOG_LEVEL]) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const log = {
  debug: (message: string, fields: Record<string, unknown> = {}) => write("debug", message, fields),
  info: (message: string, fields: Record<string, unknown> = {}) => write("info", message, fields),
  error: (message: string, fields: Record<string, unknown> = {}) => write("error", message, fields),
};
