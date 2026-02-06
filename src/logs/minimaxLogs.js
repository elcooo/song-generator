const MAX_LOGS = Number(process.env.MINIMAX_LOG_LIMIT) || 200;
const logs = [];

export function addMinimaxLog(entry) {
  if (!entry) return;
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }
}

export function getMinimaxLogs(since = 0) {
  const cutoff = Number.isFinite(since) ? since : 0;
  return logs.filter((item) => item.ts > cutoff);
}
