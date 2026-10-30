// Coraggio CSV import: reads back the format "Export contacts" writes.
import { format, isValid, parse, parseISO } from "date-fns";

import type { CsvCustomColumn } from "./coraggio";
import type { CustomFieldDef, CustomFieldsConfig } from "./custom-fields";
import {
  FOLLOW_UP_TASK_FIELD,
  FOLLOW_UP_TASK_SECTION,
  getContactCsvCustomColumns,
  getContactCsvHeaders,
  toCsv,
} from "./coraggio";

export const CSV_IMPORT_MAX_ROWS = 2000;

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/** RFC 4180 CSV decoding (the counterpart of `toCsv`); strips a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = text.startsWith("﻿") ? 1 : 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ─── Values ───────────────────────────────────────────────────────────────────

type ParseResult = { value: unknown } | { error: string };

const DATE_HINT = "use YYYY-MM-DD or M/D/YYYY";
const DATE_TIME_HINT = "use YYYY-MM-DD HH:mm or M/D/YYYY h:mm AM";

const isPlausibleYear = (date: Date) =>
  date.getFullYear() >= 1900 && date.getFullYear() <= 2200;

function parseWithFormats(text: string, formats: string[]): Date | null {
  for (const fmt of formats) {
    const date = parse(text, fmt, new Date(2000, 0, 1));
    if (isValid(date) && isPlausibleYear(date)) return date;
  }
  return null;
}

/** YYYY-MM-DD from "YYYY-MM-DD" or "M/D/YYYY", or null. */
export function parseImportDate(text: string): string | null {
  const date = parseWithFormats(text.trim(), ["yyyy-MM-dd", "M/d/yyyy"]);
  return date ? format(date, "yyyy-MM-dd") : null;
}

/** Local "YYYY-MM-DDTHH:mm" (what datetime-local fields store), or a full ISO timestamp as written; null if neither. */
export function parseImportDateTime(text: string): string | null {
  const trimmed = text.trim();
  // A full ISO timestamp (seconds, zone) is kept as written, like the export shows it
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    const iso = parseISO(trimmed);
    return isValid(iso) && isPlausibleYear(iso) ? trimmed : null;
  }
  const date = parseWithFormats(trimmed, [
    "yyyy-MM-dd'T'HH:mm",
    "yyyy-MM-dd HH:mm",
    "yyyy-MM-dd",
    "M/d/yyyy H:mm",
    "M/d/yyyy h:mm a",
    "M/d/yyyy",
  ]);
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : null;
}

/** Option key whose label or key matches, ignoring case. */
function matchOption(field: CustomFieldDef, text: string): string | undefined {
  const needle = text.trim().toLowerCase();
  return Object.entries(field.options ?? {}).find(
    ([key, label]) =>
      label.toLowerCase() === needle || key.toLowerCase() === needle,
  )?.[0];
}

/** Whether a select field accepts values that aren't one of its options. */
const allowsFreeText = (field: CustomFieldDef) =>
  field.style === "autofill" || Boolean(field.allowOther);

const optionList = (field: CustomFieldDef) =>
  Object.values(field.options ?? {}).join(", ");

function parseSelect(field: CustomFieldDef, text: string): ParseResult {
  if (!field.multiple) {
    const key = matchOption(field, text);
    if (key !== undefined) return { value: key };
    if (allowsFreeText(field)) return { value: text };
    return { error: `"${text}" isn't one of: ${optionList(field)}` };
  }

  // The export joins labels with ", ". Match the longest run of tokens first,
  // so an option label that contains a comma still works.
  const tokens = text.split(",").map((token) => token.trim());
  const keys: string[] = [];
  const unknown: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (let end = tokens.length; end > i; end--) {
      const key = matchOption(field, tokens.slice(i, end).join(", "));
      if (key !== undefined) {
        if (!keys.includes(key)) keys.push(key);
        i = end;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const token = tokens[i];
      if (token) unknown.push(token);
      i++;
    }
  }

  if (unknown.length === 0) return { value: keys };
  // A checkbox "Other" holds one free-text value next to the option keys
  if (field.allowOther) return { value: [...keys, unknown.join(", ")] };
  if (field.style === "autofill") return { value: [...keys, ...unknown] };
  return {
    error: `${unknown.map((u) => `"${u}"`).join(", ")} isn't one of: ${optionList(field)}`,
  };
}

/** "line1, line2, City, ST ZIP" (the export's format), read from the end. */
function parseAddress(text: string): ParseResult {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const address: Record<string, string> = {};

  const last = parts[parts.length - 1] ?? "";
  const stateZip = /^([A-Za-z][A-Za-z .]*?)\s+(\d{5}(?:-\d{4})?)$/.exec(last);
  if (stateZip) {
    address.state = stateZip[1] ?? "";
    address.zip = stateZip[2] ?? "";
    parts.pop();
  } else if (/^\d{5}(?:-\d{4})?$/.test(last)) {
    address.zip = last;
    parts.pop();
  } else if (/^[A-Z]{2}$/.test(last)) {
    address.state = last;
    parts.pop();
  }
  if (parts.length >= 2) address.city = parts.pop() ?? "";
  if (parts.length) address.line1 = parts.shift() ?? "";
  if (parts.length) address.line2 = parts.join(", ");

  return { value: address };
}

/** "English: Fluent; Spanish: Conversational" */
function parseKeyValue(field: CustomFieldDef, text: string): ParseResult {
  const [keyField, valueField] = Object.values(field.fields ?? {});
  const result: Record<string, unknown> = {};

  for (const entry of text.split(";").map((e) => e.trim()).filter(Boolean)) {
    const colon = entry.indexOf(":");
    if (colon < 0) {
      return { error: `"${entry}" should look like "${keyField?.title ?? "Key"}: ${valueField?.title ?? "Value"}"` };
    }
    const keyText = entry.slice(0, colon).trim();
    const valueText = entry.slice(colon + 1).trim();

    const key = keyField ? parseCustomFieldValue(keyField, keyText) : { value: keyText };
    if ("error" in key) return key;
    const value = valueField
      ? parseCustomFieldValue(valueField, valueText)
      : { value: valueText };
    if ("error" in value) return value;
    result[String(key.value)] = value.value ?? "";
  }

  return { value: result };
}

/**
 * Splits one list/timeseries entry into at most `count` parts on " – " (or "—",
 * or " - "). The last part keeps any further dashes (e.g. in notes).
 */
function splitEntryParts(entry: string, count: number): string[] {
  const separator = /\s*[–—]\s*|\s+-\s+/g;
  const parts: string[] = [];
  let start = 0;
  let match: RegExpExecArray | null;
  while (parts.length < count - 1 && (match = separator.exec(entry))) {
    parts.push(entry.slice(start, match.index).trim());
    start = match.index + match[0].length;
  }
  parts.push(entry.slice(start).trim());
  return parts;
}

function parseEntries(field: CustomFieldDef, entries: string[]): ParseResult {
  const subFields = Object.entries(field.fields ?? {});
  const records: Record<string, unknown>[] = [];

  for (const entry of entries) {
    const parts = splitEntryParts(entry, subFields.length);
    const record: Record<string, unknown> = {};
    for (const [index, [key, subField]] of subFields.entries()) {
      const parsed = parseCustomFieldValue(subField, parts[index] ?? "");
      if ("error" in parsed) return { error: `${subField.title}: ${parsed.error}` };
      if (parsed.value !== undefined) record[key] = parsed.value;
    }
    if (Object.keys(record).length) records.push(record);
  }

  return { value: records };
}

/**
 * The value to store for one cell, the inverse of `formatCustomFieldValue`.
 * An empty cell gives `{ value: undefined }` (nothing stored).
 */
export function parseCustomFieldValue(
  field: CustomFieldDef,
  cell: string,
): ParseResult {
  const text = cell.trim();
  if (!text) return { value: undefined };

  switch (field.type) {
    case "select":
      return parseSelect(field, text);

    case "address":
      return parseAddress(text);

    case "keyvalue":
      return parseKeyValue(field, text);

    case "list":
      return parseEntries(
        field,
        text.split(";").map((e) => e.trim()).filter(Boolean),
      );

    case "timeseries":
      // Each entry starts with its date, so notes can contain semicolons
      return parseEntries(
        field,
        text
          .split(/\s*;\s*(?=\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/)
          .filter(Boolean),
      );

    case "date": {
      const date = parseImportDate(text);
      return date ? { value: date } : { error: `"${text}" isn't a date (${DATE_HINT})` };
    }

    case "datetime-local": {
      const date = parseImportDateTime(text);
      return date
        ? { value: date }
        : { error: `"${text}" isn't a date (${DATE_TIME_HINT})` };
    }

    case "number":
    case "range": {
      const number = Number(text.replace(/,/g, ""));
      if (!Number.isFinite(number)) return { error: `"${text}" isn't a number` };
      const min = field.min === undefined ? undefined : Number(field.min);
      const max = field.max === undefined ? undefined : Number(field.max);
      if ((min !== undefined && number < min) || (max !== undefined && number > max)) {
        return { error: `${number} isn't between ${min ?? "…"} and ${max ?? "…"}` };
      }
      return { value: number };
    }

    default:
      return { value: text };
  }
}

// ─── Column guide ─────────────────────────────────────────────────────────────

export interface ContactImportColumnInfo {
  header: string;
  required?: boolean;
  format: string;
  /** Allowed values, one line per group (e.g. "School Type: High School, College") */
  allowed?: string[];
}

function describeField(field: CustomFieldDef): { format: string; allowed?: string[] } {
  const options = Object.values(field.options ?? {});
  switch (field.type) {
    case "select": {
      const free = allowsFreeText(field);
      const format = field.multiple
        ? `Options separated by commas${free ? " (anything else is kept as typed)" : ""}`
        : free
          ? options.length
            ? "One of the options, or your own text"
            : "Text"
          : "One of the options";
      return { format, allowed: options.length ? [options.join(", ")] : undefined };
    }
    case "address":
      return { format: "Street, Apt (optional), City, ST ZIP" };
    case "keyvalue": {
      const [keyField, valueField] = Object.values(field.fields ?? {});
      const pair = `${keyField?.title ?? "Key"}: ${valueField?.title ?? "Value"}`;
      return {
        format: `"${pair}" pairs separated by semicolons`,
        allowed: subFieldOptions(field),
      };
    }
    case "list":
    case "timeseries": {
      const titles = Object.values(field.fields ?? {}).map((f) => f.title);
      return {
        format:
          `Entries separated by semicolons; each entry is ${titles.join(" – ")}. ` +
          "Keep the dashes around an empty part." +
          (field.type === "timeseries" ? " Each entry starts with its date." : ""),
        allowed: subFieldOptions(field),
      };
    }
    case "date":
      return { format: "Date: YYYY-MM-DD or M/D/YYYY" };
    case "datetime-local":
      return { format: "Date and time: YYYY-MM-DD HH:mm or M/D/YYYY h:mm AM" };
    case "range":
      return { format: `Number from ${field.min ?? "…"} to ${field.max ?? "…"}` };
    case "number":
      return { format: "Number" };
    default:
      return { format: "Text" };
  }
}

/** "Sub-field: option, option" lines for the select sub-fields of a compound field. */
function subFieldOptions(field: CustomFieldDef): string[] | undefined {
  const lines = Object.values(field.fields ?? {}).flatMap((subField) => {
    if (subField.type === "date" || subField.type === "datetime-local") {
      return [`${subField.title}: ${describeField(subField).format.replace(/^Date( and time)?: /, "")}`];
    }
    const options = Object.values(subField.options ?? {});
    if (subField.type !== "select" || !options.length) return [];
    const extra = allowsFreeText(subField) ? " (or your own text)" : "";
    return [`${subField.title}: ${options.join(", ")}${extra}`];
  });
  return lines.length ? lines : undefined;
}

/** Every importable column, in template order, with its format. */
export function getContactImportGuide(
  config: CustomFieldsConfig,
  { statuses, labels }: { statuses: string[]; labels: string[] },
): ContactImportColumnInfo[] {
  const headers = getContactCsvHeaders(config);
  return [
    {
      header: headers.name,
      required: true,
      format: "Text. Must be unique: a name already in coragg.io, or twice in the file, is an error.",
    },
    {
      header: headers.status,
      format: "One of the statuses. Blank: the first status.",
      allowed: [statuses.join(", ")],
    },
    { header: headers.dueDate, format: "Date: YYYY-MM-DD or M/D/YYYY" },
    { header: headers.followUpTask, format: "Text" },
    {
      header: headers.members,
      format: "Team members' names or emails, separated by commas",
    },
    {
      header: headers.labels,
      format: "Label names, separated by commas",
      allowed: labels.length ? [labels.join(", ")] : undefined,
    },
    { header: headers.starred, format: "Yes, or blank" },
    { header: headers.notes, format: "Text" },
    ...getContactCsvCustomColumns(config).map((column) => ({
      header: column.header,
      ...describeField(column.field),
    })),
  ];
}

/** Header row of the import template: the export's columns without Created and Link. */
export function buildContactImportTemplate(config: CustomFieldsConfig): string {
  const headers = getContactCsvHeaders(config);
  return toCsv([
    [
      headers.name,
      headers.status,
      headers.dueDate,
      headers.followUpTask,
      headers.members,
      headers.labels,
      headers.starred,
      headers.notes,
      ...getContactCsvCustomColumns(config).map((column) => column.header),
    ],
  ]);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ContactImportContext {
  /** Statuses contacts can go to; the first one is the default. */
  lists: { id: number; name: string; boardId: number }[];
  labels: { id: number; name: string; boardId: number }[];
  members: { id: number; name: string | null; email: string }[];
  /** Names of the diocese's existing contacts, lowercased and trimmed. */
  existingNames: Set<string>;
}

export interface ImportedContact {
  /** Spreadsheet row number (the header is row 1). */
  row: number;
  title: string;
  listId: number;
  /** Follow-up date as YYYY-MM-DD; the API converts it with the importer's time zone. */
  dueDate: string | null;
  description: string;
  labelIds: number[];
  memberIds: number[];
  customData: Record<string, unknown> | null;
}

export interface ContactImportError {
  /** Spreadsheet row number, or null for a problem with the header row or the file. */
  row: number | null;
  column?: string;
  message: string;
}

type FixedColumn =
  | "name"
  | "status"
  | "dueDate"
  | "followUpTask"
  | "members"
  | "labels"
  | "starred"
  | "notes";

type ColumnHandler =
  | { kind: "fixed"; key: FixedColumn; header: string }
  | { kind: "custom"; column: CsvCustomColumn; header: string };

const normalizeHeader = (header: string) =>
  header.trim().replace(/\s+/g, " ").toLowerCase();

const normalizeStatus = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/s$/, "");

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function closestHeader(header: string, candidates: string[]): string | undefined {
  const needle = normalizeHeader(header);
  let best: { header: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = editDistance(needle, normalizeHeader(candidate));
    if (!best || distance < best.distance) best = { header: candidate, distance };
  }
  return best && best.distance <= Math.max(3, needle.length / 3)
    ? best.header
    : undefined;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain-text notes as editor HTML: blank lines split paragraphs. */
function notesToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const splitList = (text: string) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Validates a parsed CSV (header row first) against the board config and the
 * diocese's statuses, labels, members and existing contacts. Contacts are only
 * meant to be created when `errors` is empty.
 */
export function validateContactImport(
  config: CustomFieldsConfig,
  rows: string[][],
  context: ContactImportContext,
): {
  contacts: ImportedContact[];
  errors: ContactImportError[];
  ignoredColumns: string[];
} {
  const errors: ContactImportError[] = [];
  const ignoredColumns: string[] = [];
  const headerRow = rows[0] ?? [];
  const fixedHeaders = getContactCsvHeaders(config);

  const known = new Map<string, ColumnHandler>();
  for (const key of [
    "name",
    "status",
    "dueDate",
    "followUpTask",
    "members",
    "labels",
    "starred",
    "notes",
  ] as const) {
    known.set(normalizeHeader(fixedHeaders[key]), {
      kind: "fixed",
      key,
      header: fixedHeaders[key],
    });
  }
  for (const column of getContactCsvCustomColumns(config)) {
    known.set(normalizeHeader(column.header), {
      kind: "custom",
      column,
      header: column.header,
    });
  }
  const exportOnly = new Set(
    [fixedHeaders.created, fixedHeaders.link].map(normalizeHeader),
  );

  // Column index → handler
  const handlers = new Map<number, ColumnHandler>();
  const seen = new Set<string>();
  headerRow.forEach((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (!header) return;
    if (exportOnly.has(header)) {
      ignoredColumns.push(rawHeader.trim());
      return;
    }
    const handler = known.get(header);
    if (!handler) {
      const suggestion = closestHeader(
        rawHeader,
        [...known.values()].map((h) => h.header),
      );
      errors.push({
        row: 1,
        column: rawHeader.trim(),
        message: suggestion
          ? `Unknown column. Did you mean "${suggestion}"?`
          : "Unknown column. Use the column names from the template.",
      });
      return;
    }
    if (seen.has(header)) {
      errors.push({ row: 1, column: handler.header, message: "This column appears twice." });
      return;
    }
    seen.add(header);
    handlers.set(index, handler);
  });

  if (!seen.has(normalizeHeader(fixedHeaders.name))) {
    errors.push({
      row: 1,
      column: fixedHeaders.name,
      message: `The file needs a "${fixedHeaders.name}" column. Is the first row the column names?`,
    });
    return { contacts: [], errors, ignoredColumns };
  }

  const dataRows = rows
    .slice(1)
    .map((cells, index) => ({ cells, row: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim()));

  if (dataRows.length === 0) {
    errors.push({ row: null, message: "The file has no contacts." });
    return { contacts: [], errors, ignoredColumns };
  }
  if (dataRows.length > CSV_IMPORT_MAX_ROWS) {
    errors.push({
      row: null,
      message: `The file has ${dataRows.length} contacts; import at most ${CSV_IMPORT_MAX_ROWS} at a time.`,
    });
    return { contacts: [], errors, ignoredColumns };
  }

  const columnOrder = new Map(
    [...handlers].map(([index, handler]) => [handler.header, index]),
  );
  const defaultList = context.lists[0];
  const namesInFile = new Map<string, number>();
  const contacts: ImportedContact[] = [];

  for (const { cells, row } of dataRows) {
    const rowErrors: ContactImportError[] = [];
    const fail = (column: string, message: string) =>
      rowErrors.push({ row, column, message });

    const fixed: Partial<Record<FixedColumn, { text: string; header: string }>> = {};
    const customData: Record<string, unknown> = {};
    const setCustom = (sectionKey: string, fieldKey: string, value: unknown) => {
      const section = (customData[sectionKey] ??= {}) as Record<string, unknown>;
      section[fieldKey] = value;
    };

    for (const [index, handler] of handlers) {
      const text = (cells[index] ?? "").trim();
      if (handler.kind === "fixed") {
        fixed[handler.key] = { text, header: handler.header };
        continue;
      }
      const { column } = handler;
      const parsed = parseCustomFieldValue(column.field, text);
      if ("error" in parsed) {
        fail(handler.header, parsed.error);
      } else if (parsed.value !== undefined) {
        if (column.field.type === "timeseries") customData[column.sectionKey] = parsed.value;
        else setCustom(column.sectionKey, column.fieldKey, parsed.value);
      }
    }

    // Name
    const title = fixed.name?.text ?? "";
    const nameKey = title.toLowerCase();
    if (!title) {
      fail(fixedHeaders.name, "A name is required.");
    } else if (title.length > 2000) {
      fail(fixedHeaders.name, "The name is too long.");
    } else if (context.existingNames.has(nameKey)) {
      fail(fixedHeaders.name, `"${title}" is already a contact.`);
    } else if (namesInFile.has(nameKey)) {
      fail(fixedHeaders.name, `"${title}" is also on row ${namesInFile.get(nameKey)}.`);
    }
    if (title && !namesInFile.has(nameKey)) namesInFile.set(nameKey, row);

    // Status
    const statusText = fixed.status?.text ?? "";
    const list = statusText
      ? (context.lists.find(
          (l) => l.name.trim().toLowerCase() === statusText.toLowerCase(),
        ) ??
        context.lists.find(
          (l) => normalizeStatus(l.name) === normalizeStatus(statusText),
        ))
      : defaultList;
    if (!list) {
      fail(
        fixedHeaders.status,
        statusText
          ? `"${statusText}" isn't a status. Use one of: ${context.lists.map((l) => l.name).join(", ")}`
          : "The board has no statuses.",
      );
    }

    // Follow-up date
    let dueDate: string | null = null;
    if (fixed.dueDate?.text) {
      dueDate = parseImportDate(fixed.dueDate.text);
      if (!dueDate) {
        fail(fixedHeaders.dueDate, `"${fixed.dueDate.text}" isn't a date (${DATE_HINT})`);
      }
    }

    if (fixed.followUpTask?.text) {
      setCustom(FOLLOW_UP_TASK_SECTION, FOLLOW_UP_TASK_FIELD, fixed.followUpTask.text);
    }

    // Assigned to: name or email
    const memberIds: number[] = [];
    for (const entry of splitList(fixed.members?.text ?? "")) {
      const needle = entry.toLowerCase();
      const byEmail = context.members.filter((m) => m.email.toLowerCase() === needle);
      const matches = byEmail.length
        ? byEmail
        : context.members.filter((m) => m.name?.trim().toLowerCase() === needle);
      const [match] = matches;
      if (match && matches.length === 1) {
        if (!memberIds.includes(match.id)) memberIds.push(match.id);
      } else if (matches.length > 1) {
        fail(fixedHeaders.members, `More than one team member is named "${entry}"; use their email.`);
      } else {
        fail(fixedHeaders.members, `"${entry}" isn't a team member's name or email.`);
      }
    }

    // Labels, matched on the status's board
    const labelIds: number[] = [];
    if (list) {
      const boardLabels = context.labels.filter((l) => l.boardId === list.boardId);
      for (const name of splitList(fixed.labels?.text ?? "")) {
        const label = boardLabels.find(
          (l) => l.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (!label) {
          fail(
            fixedHeaders.labels,
            `"${name}" isn't a label. Use one of: ${boardLabels.map((l) => l.name).join(", ")}`,
          );
        } else if (!labelIds.includes(label.id)) {
          labelIds.push(label.id);
        }
      }
    }

    // Starred
    const starredText = (fixed.starred?.text ?? "").toLowerCase();
    if (["yes", "y", "true", "1", "x"].includes(starredText)) {
      setCustom("meta", "starred", true);
    } else if (starredText && !["no", "n", "false", "0"].includes(starredText)) {
      fail(fixedHeaders.starred, `"${fixed.starred?.text}" should be Yes or blank.`);
    }

    // card.create allows 10,000 characters of description HTML
    const description = notesToHtml(fixed.notes?.text ?? "");
    if (description.length > 10000) {
      fail(fixedHeaders.notes, "The notes are too long (about 9,000 characters at most).");
    }

    if (rowErrors.length || !list) {
      // In the file's column order
      errors.push(
        ...rowErrors.sort(
          (a, b) =>
            (columnOrder.get(a.column ?? "") ?? 0) -
            (columnOrder.get(b.column ?? "") ?? 0),
        ),
      );
      continue;
    }

    contacts.push({
      row,
      title,
      listId: list.id,
      dueDate,
      description,
      labelIds,
      memberIds,
      customData: Object.keys(customData).length ? customData : null,
    });
  }

  return { contacts, errors, ignoredColumns };
}
