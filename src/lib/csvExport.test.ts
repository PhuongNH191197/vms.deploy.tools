import { describe, it, expect } from "vitest";
import {
  escapeCell,
  buildCsv,
  auditRowsToMatrix,
  AUDIT_CSV_HEADERS,
} from "./csvExport";

// ── escapeCell ────────────────────────────────────────────────────────────────

describe("escapeCell", () => {
  it("wraps plain strings in quotes", () => {
    expect(escapeCell("hello")).toBe('"hello"');
  });

  it("escapes embedded double-quotes by doubling them", () => {
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("handles empty string", () => {
    expect(escapeCell("")).toBe('""');
  });

  it("converts null to empty quoted string", () => {
    expect(escapeCell(null)).toBe('""');
  });

  it("converts undefined to empty quoted string", () => {
    expect(escapeCell(undefined)).toBe('""');
  });

  it("converts numbers to quoted string", () => {
    expect(escapeCell(42)).toBe('"42"');
    expect(escapeCell(0)).toBe('"0"');
  });

  it("handles string with commas (no extra escaping needed — already quoted)", () => {
    expect(escapeCell("a,b,c")).toBe('"a,b,c"');
  });

  it("handles newlines inside a cell", () => {
    expect(escapeCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

// ── buildCsv ──────────────────────────────────────────────────────────────────

describe("buildCsv", () => {
  it("returns empty string when rows array is empty", () => {
    expect(buildCsv(["a", "b"], [])).toBe("");
  });

  it("produces header + one data row", () => {
    const csv = buildCsv(["name", "age"], [["Alice", "30"]]);
    expect(csv).toBe('name,age\n"Alice","30"');
  });

  it("produces header + multiple rows, newline-separated", () => {
    const csv = buildCsv(["x"], [["1"], ["2"], ["3"]]);
    expect(csv).toBe('x\n"1"\n"2"\n"3"');
  });

  it("escapes cells that contain double-quotes", () => {
    const csv = buildCsv(["q"], [['"quoted"']]);
    expect(csv).toBe('q\n"""quoted"""');
  });

  it("header row is not quoted (plain CSV header convention)", () => {
    const csv = buildCsv(["deployed_at", "server"], [["2024-01-01", "prod"]]);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe("deployed_at,server");
  });
});

// ── auditRowsToMatrix ─────────────────────────────────────────────────────────

const SAMPLE_RECORD = {
  deployed_at: "2024-05-01T10:00:00",
  server_name: "prod-01",
  module_name: "nginx",
  module_version: "1.2.3",
  action: "deploy",
  status: "success",
  operator_ip: "192.168.1.1",
  operator_host: "devbox",
};

describe("auditRowsToMatrix", () => {
  it("returns empty array for empty input", () => {
    expect(auditRowsToMatrix([])).toEqual([]);
  });

  it("maps one record to one 8-element row", () => {
    const matrix = auditRowsToMatrix([SAMPLE_RECORD]);
    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toHaveLength(8);
  });

  it("maps fields in correct column order", () => {
    const [row] = auditRowsToMatrix([SAMPLE_RECORD]);
    expect(row[0]).toBe("2024-05-01T10:00:00");
    expect(row[1]).toBe("prod-01");
    expect(row[2]).toBe("nginx");
    expect(row[3]).toBe("1.2.3");
    expect(row[4]).toBe("deploy");
    expect(row[5]).toBe("success");
    expect(row[6]).toBe("192.168.1.1");
    expect(row[7]).toBe("devbox");
  });

  it("maps multiple records preserving order", () => {
    const r2 = { ...SAMPLE_RECORD, server_name: "staging-01", status: "failed" };
    const matrix = auditRowsToMatrix([SAMPLE_RECORD, r2]);
    expect(matrix).toHaveLength(2);
    expect(matrix[0][1]).toBe("prod-01");
    expect(matrix[1][1]).toBe("staging-01");
    expect(matrix[1][5]).toBe("failed");
  });
});

// ── integration: buildCsv(AUDIT_CSV_HEADERS, auditRowsToMatrix(records)) ─────

describe("full CSV pipeline", () => {
  it("produces parseable audit log CSV", () => {
    const matrix = auditRowsToMatrix([SAMPLE_RECORD]);
    const csv = buildCsv(AUDIT_CSV_HEADERS, matrix);

    const lines = csv.split("\n");
    expect(lines[0]).toBe(AUDIT_CSV_HEADERS.join(","));
    expect(lines[1]).toContain('"prod-01"');
    expect(lines[1]).toContain('"success"');
  });

  it("AUDIT_CSV_HEADERS has 8 columns matching auditRowsToMatrix output", () => {
    expect(AUDIT_CSV_HEADERS).toHaveLength(8);
    const matrix = auditRowsToMatrix([SAMPLE_RECORD]);
    expect(matrix[0]).toHaveLength(AUDIT_CSV_HEADERS.length);
  });
});
