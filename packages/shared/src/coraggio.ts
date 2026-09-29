// Coraggio fork-owned helpers shared by the API and web app.
import type { CustomFieldDef, CustomFieldsConfig } from "./custom-fields";
import {
  getCustomDataValue,
  getCustomSections,
  getMainCustomFields,
  getSidebarCustomFields,
} from "./custom-fields";

type CustomData = Record<string, unknown> | null | undefined;

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

/** Starred contacts are flagged at customData.meta.starred (not a configurable section). */
export function isCardStarred(customData: CustomData): boolean {
  return getCustomDataValue(customData, "meta", "starred") === true;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

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
          return parts.filter(Boolean).join(" – ");
        })
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
