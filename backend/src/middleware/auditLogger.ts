export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  action: string;
  endpoint: string;
  method: string;
  statusCode: number;
}

const auditLog: AuditLogEntry[] = [];

export function logAdminAction(entry: Omit<AuditLogEntry, "timestamp">): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getAuditLog(limit?: number): ReadonlyArray<AuditLogEntry> {
  return limit ? auditLog.slice(-limit) : auditLog;
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}
