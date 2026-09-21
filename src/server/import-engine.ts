import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { EventType } from "@prisma/client";

export type ParsedRow = { externalId: string; timestamp: Date; type: EventType; sourceRow: number; raw: Record<string, unknown> };
export type ImportMapping = { externalId?: string; timestamp?: string; type?: string; adapter?: "auto" | "manual" };

export function parseDateTime(value: unknown) {
  const date = new Date(String(value ?? "").trim().replace("/", "-"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeType(value: unknown): EventType {
  const v = String(value ?? "").trim().toLowerCase();
  if (["in", "entry", "clock-in", "check-in", "clockin", "checkin", "on duty", "ورود", "1"].includes(v)) return EventType.IN;
  if (["out", "exit", "clock-out", "check-out", "clockout", "checkout", "off duty", "خروج", "0"].includes(v)) return EventType.OUT;
  if (["break_start", "شروع استراحت"].includes(v)) return EventType.BREAK_START;
  if (["break_end", "پایان استراحت"].includes(v)) return EventType.BREAK_END;
  return EventType.UNKNOWN;
}

function normalizeVendorStatus(value: unknown): EventType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "0") return EventType.IN;
  if (normalized === "1") return EventType.OUT;
  if (normalized === "2") return EventType.BREAK_END;
  if (normalized === "3") return EventType.BREAK_START;
  return normalizeType(value);
}

function cleanHeader(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function chooseHeader(headers: string[], aliases: string[]) { return headers.find((header) => aliases.includes(cleanHeader(header))); }
function valueFor(row: Record<string, unknown>, header?: string) { return header ? row[header] : undefined; }

function rowsFromMatrix(rows: Record<string, unknown>[], mapping: ImportMapping) {
  if (mapping.adapter !== "auto" && mapping.externalId && mapping.timestamp) {
    return rows.map((row, index) => {
      const timestamp = parseDateTime(row[mapping.timestamp!]);
      const externalId = String(row[mapping.externalId!] ?? "").trim();
      return timestamp && externalId ? { externalId, timestamp, type: normalizeType(mapping.type ? row[mapping.type] : undefined), sourceRow: index + 2, raw: row } : null;
    }).filter((row): row is ParsedRow => Boolean(row));
  }

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const externalHeader = chooseHeader(headers, ["employeecode", "employeeid", "userid", "user", "pin", "acno", "empno", "personid", "badgeno", "cardno", "externalid"]);
  const timestampHeader = chooseHeader(headers, ["timestamp", "datetime", "eventtime", "punchtime", "eventdatetime"]);
  const dateHeader = chooseHeader(headers, ["date", "eventdate", "punchdate"]);
  const timeHeader = chooseHeader(headers, ["time", "eventtimeonly", "punchtimeonly"]);
  const typeHeader = chooseHeader(headers, ["type", "event", "eventtype", "attendance", "ta", "status", "punchtype"]);
  const firstInHeader = chooseHeader(headers, ["firstin", "firstentry", "checkin", "clockin"]);
  const lastOutHeader = chooseHeader(headers, ["lastout", "lastexit", "checkout", "clockout"]);
  const output: ParsedRow[] = [];

  rows.forEach((row, index) => {
    const externalId = String(valueFor(row, mapping.externalId ?? externalHeader) ?? "").trim();
    if (!externalId) return;
    const make = (value: unknown, type: EventType) => {
      const candidate = dateHeader && typeof value === "string" && /^\d{1,2}:\d{2}/.test(value.trim()) ? `${valueFor(row, dateHeader)} ${value}` : value;
      const timestamp = parseDateTime(candidate);
      if (timestamp) output.push({ externalId, timestamp, type, sourceRow: index + 2, raw: row });
    };
    if (firstInHeader || lastOutHeader) {
      make(valueFor(row, firstInHeader), EventType.IN);
      make(valueFor(row, lastOutHeader), EventType.OUT);
      return;
    }
    const combined = valueFor(row, mapping.timestamp ?? timestampHeader) ?? (dateHeader && timeHeader ? `${valueFor(row, dateHeader)} ${valueFor(row, timeHeader)}` : undefined);
    make(combined, typeHeader ? normalizeVendorStatus(valueFor(row, mapping.type ?? typeHeader)) : EventType.UNKNOWN);
  });
  return output;
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

export function parseDelimited(content: string, mapping: ImportMapping = { adapter: "auto" }) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = parseCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => { const values = parseCsvLine(line, delimiter); return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])); });
  return rowsFromMatrix(rows, mapping);
}

export function parseXlsx(buffer: Buffer, mapping: ImportMapping = { adapter: "auto" }, sheet?: string) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: false });
  const name = sheet ?? workbook.SheetNames[0];
  if (!name) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: "" });
  return rowsFromMatrix(rows, mapping);
}

export function fingerprint(deviceId: string, row: ParsedRow) {
  return crypto.createHash("sha256").update([deviceId, row.externalId, row.timestamp.toISOString(), row.type].join("|")).digest("hex");
}
