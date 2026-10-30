// Coraggio fork-owned helpers shared by the API and web app.
import type { CustomFieldDef, CustomFieldsConfig } from "./custom-fields";
import {
  getCustomDataValue,
  getCustomSections,
  getMainCustomFields,
  getSidebarCustomFields,
} from "./custom-fields";

type CustomData = Record<string, unknown> | null | undefined;

/** Product name: sidebar logo, and the default board name (not shown as a title). */
export const CORAGGIO_APP_NAME = "coragg.io";

/** Public source of the running fork (AGPLv3 §13: offer the source to network users). */
export const CORAGGIO_SOURCE_CODE_URL = "https://github.com/5-stones/kan/tree/coraggio";

/**
 * Source code link for the running build: the exact commit when the build knows it
 * (NEXT_PUBLIC_SOURCE_COMMIT, written by CI), else the branch.
 */
export function getCoraggioSourceCodeUrl(commit?: string | null): string {
  const sha = commit?.trim();
  return sha && /^[0-9a-f]{7,40}$/i.test(sha)
    ? `https://github.com/5-stones/kan/tree/${sha}`
    : CORAGGIO_SOURCE_CODE_URL;
}

/** Support and feedback address (user menu, account deletion requests). */
export const CORAGGIO_SUPPORT_EMAIL = "support@coragg.io";

/** Beta feedback form (Teamwork), linked from the sidebar. */
export const CORAGGIO_FEEDBACK_FORM_URL =
  "https://5stones.teamwork.com/app/public/forms/amNpvkHNW33Zwk0B8eq";

/** Runtime theme (themes/coraggio.yaml) given to diocese workspaces and their boards. */
export const CORAGGIO_THEME_ID = "coraggio";

/**
 * Stands in for a source board in board.create: build the board from the built-in
 * template file (CORAGGIO_BOARD_TEMPLATE) instead of cloning a template board.
 */
export const CORAGGIO_BUILT_IN_TEMPLATE_ID = "coraggio-built-in-template";

/** Slug of the per-diocese archive board (seminarians and non-candidates). */
export const CORAGGIO_ARCHIVE_BOARD_SLUG = "archive";

/** customData location of the free-form task tied to the follow-up (due) date. */
export const FOLLOW_UP_TASK_SECTION = "sidebar";
export const FOLLOW_UP_TASK_FIELD = "followUpTask";

export function getFollowUpTask(customData: CustomData): string {
  const value = getCustomDataValue(
    customData,
    FOLLOW_UP_TASK_SECTION,
    FOLLOW_UP_TASK_FIELD,
  );
  return typeof value === "string" ? value.trim() : "";
}

/** Home parish (`spiritual.homeParish`), shown next to the contact's name in emails. */
export function getContactParish(customData: CustomData): string {
  const value = getCustomDataValue(customData, "spiritual", "homeParish");
  return typeof value === "string" ? value.trim() : "";
}

/** Starred contacts are flagged at customData.meta.starred (not a configurable section). */
export function isCardStarred(customData: CustomData): boolean {
  return getCustomDataValue(customData, "meta", "starred") === true;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

/** Headers of the fixed (non custom field) CSV columns, shared by export and import. */
export function getContactCsvHeaders(config: CustomFieldsConfig) {
  const sidebar = config.sidebar?.fields ?? {};
  const title = (key: string, fallback: string) =>
    (sidebar[key] as { title?: string } | undefined)?.title ?? fallback;
  return {
    name: config.main?.fields?.title?.title ?? "Name",
    status: title("list", "Status"),
    dueDate: title("dueDate", "Follow-up Date"),
    followUpTask: "Follow-up Task",
    members: title("members", "Assigned To"),
    labels: title("labels", "Labels"),
    starred: "Starred",
    notes: config.main?.fields?.description?.title ?? "Notes",
    created: "Created",
    link: "Link",
  };
}

/** Custom field columns of the export: the follow-up task already has a fixed column. */
export function getContactCsvCustomColumns(
  config: CustomFieldsConfig,
): CsvCustomColumn[] {
  return getCsvCustomColumns(config).filter(
    (column) =>
      !(
        column.sectionKey === FOLLOW_UP_TASK_SECTION &&
        column.fieldKey === FOLLOW_UP_TASK_FIELD
      ),
  );
}

export interface CsvCustomColumn {
  header: string;
  sectionKey: string;
  fieldKey: string;
  field: CustomFieldDef;
}

/**
 * Flattens a board's custom fields config into one CSV column per field.
 * Nested fields inside `section` fields are stored flat in their section, so
 * they get their own column; `list`/`keyvalue` fields are serialized as one cell.
 */
export function getCsvCustomColumns(
  config: CustomFieldsConfig,
): CsvCustomColumn[] {
  const columns: CsvCustomColumn[] = [];

  const walk = (
    sectionKey: string,
    sectionTitle: string | undefined,
    fields: Record<string, CustomFieldDef>,
  ) => {
    for (const [fieldKey, field] of Object.entries(fields)) {
      if (field.type === "section" && field.fields) {
        walk(sectionKey, sectionTitle, field.fields);
        continue;
      }
      columns.push({
        header: sectionTitle ? `${sectionTitle}: ${field.title}` : field.title,
        sectionKey,
        fieldKey,
        field,
      });
    }
  };

  for (const { key, field } of getSidebarCustomFields(config)) {
    walk("sidebar", undefined, { [key]: field });
  }
  for (const { key, field } of getMainCustomFields(config)) {
    walk("main", undefined, { [key]: field });
  }
  for (const { key, section } of getCustomSections(config)) {
    if (section.type === "timeseries") {
      // The whole timeseries section is one cell
      columns.push({
        header: section.title ?? key,
        sectionKey: key,
        fieldKey: "",
        field: {
          title: section.title ?? key,
          type: "timeseries",
          fields: section.fields,
        },
      });
      continue;
    }
    if (section.fields) walk(key, section.title, section.fields);
  }

  return columns;
}

export function getCsvCustomValue(
  customData: CustomData,
  column: CsvCustomColumn,
): string {
  const value =
    column.field.type === "timeseries"
      ? customData?.[column.sectionKey]
      : getCustomDataValue(customData, column.sectionKey, column.fieldKey);
  return formatCustomFieldValue(column.field, value);
}

function optionLabel(field: CustomFieldDef, value: unknown): string {
  const key = String(value);
  return field.options?.[key] ?? key;
}

export function formatCustomFieldValue(
  field: CustomFieldDef,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "";

  switch (field.type) {
    case "select":
      return Array.isArray(value)
        ? value.map((v) => optionLabel(field, v)).join(", ")
        : optionLabel(field, value);

    case "address": {
      if (typeof value !== "object") return String(value);
      const a = value as Record<string, unknown>;
      const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      return [a.line1, a.line2, cityLine].filter(Boolean).join(", ");
    }

    case "keyvalue": {
      if (typeof value !== "object") return String(value);
      const [keyField, valueField] = Object.values(field.fields ?? {});
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => {
          const key = keyField ? optionLabel(keyField, k) : k;
          const val = valueField ? optionLabel(valueField, v) : String(v);
          return `${key}: ${val}`;
        })
        .join("; ");
    }

    case "list":
    case "timeseries": {
      if (!Array.isArray(value)) return String(value);
      const subFields = Object.entries(field.fields ?? {});
      return value
        .map((entry) => {
          if (typeof entry !== "object" || entry === null) return String(entry);
          const record = entry as Record<string, unknown>;
          const parts = subFields.length
            ? subFields.map(([k, f]) => formatCustomFieldValue(f, record[k]))
            : Object.values(record).map(String);
          // Keep empty slots (drop only trailing ones) so the import can read entries by position
          while (parts.length && !parts[parts.length - 1]) parts.pop();
          return parts.join(" – ");
        })
        .filter(Boolean)
        .join("; ");
    }

    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/** RFC 4180 CSV encoding. */
export function toCsv(rows: string[][]): string {
  const escape = (cell: string) =>
    /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  return rows.map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

export * from "./coraggio-import";
