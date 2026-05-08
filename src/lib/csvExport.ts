export type CsvRow = Record<string, string | number | null | undefined>;

/** Escape a single cell value per RFC 4180. */
export function escapeCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from headers + rows.
 * Returns empty string when rows is empty.
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const head = headers.join(",");
  const body = rows.map((r) => r.map(escapeCell).join(",")).join("\n");
  return `${head}\n${body}`;
}

/** Convert audit log records to CSV rows. */
export function auditRowsToMatrix(
  records: Array<{
    deployed_at: string;
    server_name: string;
    module_name: string;
    module_version: string;
    action: string;
    status: string;
    operator_ip: string;
    operator_host: string;
  }>
): string[][] {
  return records.map((r) => [
    r.deployed_at,
    r.server_name,
    r.module_name,
    r.module_version,
    r.action,
    r.status,
    r.operator_ip,
    r.operator_host,
  ]);
}

export const AUDIT_CSV_HEADERS = [
  "deployed_at",
  "server",
  "module",
  "version",
  "action",
  "status",
  "operator_ip",
  "operator_host",
];
