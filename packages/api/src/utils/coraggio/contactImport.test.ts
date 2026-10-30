import { describe, expect, it } from "vitest";

import type { ContactImportContext } from "@kan/shared";
import {
  buildContactImportTemplate,
  formatCustomFieldValue,
  getContactCsvCustomColumns,
  parseCsv,
  parseCustomFieldsConfig,
  parseCustomFieldValue,
  toCsv,
  validateContactImport,
} from "@kan/shared";

import { zonedMidnightToUtc } from "./reminders";

// A trimmed-down /templates/custom-fields.yml with one field of each kind
const config = parseCustomFieldsConfig(`
main:
  fields:
    title:
      title: Name
    description:
      title: Notes
sidebar:
  fields:
    list:
      title: Status
    members:
      title: Assigned To
    dueDate:
      title: Follow-up Date
    lastContacted:
      title: Last Contacted
      type: date
    followUpTask:
      title: Follow-up Task
      type: textarea
contact:
  title: Contact Information
  type: section
  fields:
    phone:
      title: Phone Number
      type: tel
    address:
      title: Mailing Address
      type: address
spiritual:
  title: Spiritual Details
  type: section
  fields:
    homeParish:
      title: Home Parish
      type: select
      style: autofill
    prayerLife:
      title: Prayer Life
      type: select
      style: radio
      options:
        daily: daily
        occasional: occasional
    freedom:
      title: Freedom
      type: range
      min: 1
      max: 5
    faithPractices:
      title: Faith Practices
      type: select
      multiple: true
      style: checkbox
      options:
        adoration: Adoration
        smallGroup: Small Group
        youthMinistry: Young Adult, Youth Ministry
      allowOther: Other
personal:
  title: Personal Details
  type: section
  fields:
    education:
      title: Education History
      type: list
      fields:
        name:
          title: Name of School/College
          type: text
        schoolType:
          title: School Type
          type: select
          style: radio
          options:
            high_school: High School
            college: College
        area:
          title: Area of Study
          type: text
        year:
          title: Year of Graduation
          type: number
    languages:
      title: Languages
      type: keyvalue
      fields:
        language:
          title: Language
          type: select
          style: autofill
          options:
            english: English
            spanish: Spanish
        proficiency:
          title: Proficiency
          type: select
          style: radio
          options:
            conversational: Conversational
            fluent: Fluent
log:
  title: Contact Log
  type: timeseries
  fields:
    timestamp:
      title: Date
      type: datetime-local
    method:
      title: Form of Contact
      type: select
      style: autofill
      options:
        phone: Phone Call
    notes:
      title: Notes
      type: textarea
`);

const column = (header: string) => {
  const found = getContactCsvCustomColumns(config).find((c) => c.header === header);
  if (!found) throw new Error(`No column ${header}`);
  return found.field;
};

/** format → parse gives back the stored value */
const roundTrip = (header: string, value: unknown) => {
  const field = column(header);
  return parseCustomFieldValue(field, formatCustomFieldValue(field, value));
};

describe("parseCsv", () => {
  it("reads quotes, embedded commas and newlines, CRLF and a BOM", () => {
    const rows = [
      ["Name", "Notes"],
      ['Mike "Mo" Smith', "line 1\r\nline 2, still"],
      ["", ""],
    ];
    expect(parseCsv("﻿" + toCsv(rows))).toEqual(rows);
  });

  it("keeps a last row without a newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCustomFieldValue round-trips the export", () => {
  it("address", () => {
    const address = { line1: "12 Main St", line2: "Apt 3", city: "Erie", state: "PA", zip: "16501" };
    expect(roundTrip("Contact Information: Mailing Address", address)).toEqual({ value: address });
    expect(roundTrip("Contact Information: Mailing Address", { line1: "12 Main St", city: "Erie", state: "PA" })).toEqual({
      value: { line1: "12 Main St", city: "Erie", state: "PA" },
    });
  });

  it("multi-select with a comma in a label and an Other value", () => {
    const value = ["adoration", "youthMinistry", "Bible study"];
    expect(roundTrip("Spiritual Details: Faith Practices", value)).toEqual({ value });
  });

  it("single select by label or key, and rejects unknown options", () => {
    const field = column("Spiritual Details: Prayer Life");
    expect(parseCustomFieldValue(field, "Daily")).toEqual({ value: "daily" });
    expect(parseCustomFieldValue(field, "weekly")).toHaveProperty("error");
  });

  it("autofill select keeps free text", () => {
    expect(roundTrip("Spiritual Details: Home Parish", "St. Mary, Erie")).toEqual({
      value: "St. Mary, Erie",
    });
  });

  it("range checks min and max", () => {
    expect(roundTrip("Spiritual Details: Freedom", 4)).toEqual({ value: 4 });
    expect(parseCustomFieldValue(column("Spiritual Details: Freedom"), "9")).toHaveProperty("error");
  });

  it("keyvalue", () => {
    const value = { english: "fluent", spanish: "conversational" };
    expect(roundTrip("Personal Details: Languages", value)).toEqual({ value });
  });

  it("list with empty sub-fields keeps positions", () => {
    const value = [
      { name: "Cathedral Prep", schoolType: "high_school", year: 2020 },
      { name: "Gannon", schoolType: "college", area: "Theology" },
    ];
    expect(formatCustomFieldValue(column("Personal Details: Education History"), value)).toBe(
      "Cathedral Prep – High School –  – 2020; Gannon – College – Theology",
    );
    expect(roundTrip("Personal Details: Education History", value)).toEqual({ value });
  });

  it("timeseries whose notes contain semicolons and dashes", () => {
    const value = [
      { timestamp: "2026-03-01T15:00", method: "phone", notes: "Talked; he's in – for now" },
      { timestamp: "2026-04-02T09:30", method: "Coffee" },
      { timestamp: "2026-07-30T14:00:00.000Z", method: "phone", notes: "Seeded" },
    ];
    expect(roundTrip("Contact Log", value)).toEqual({ value });
  });

  it("dates", () => {
    const field = column("Last Contacted");
    expect(parseCustomFieldValue(field, "2026-03-01")).toEqual({ value: "2026-03-01" });
    expect(parseCustomFieldValue(field, "3/1/2026")).toEqual({ value: "2026-03-01" });
    expect(parseCustomFieldValue(field, "13/45/2026")).toHaveProperty("error");
  });
});

describe("validateContactImport", () => {
  const context: ContactImportContext = {
    lists: [
      { id: 1, name: "Prospective Discerners", boardId: 10 },
      { id: 2, name: "Discerners", boardId: 10 },
      { id: 3, name: "Seminarians", boardId: 20 },
    ],
    labels: [
      { id: 100, name: "NSPV Lead", boardId: 10 },
      { id: 200, name: "NSPV Lead", boardId: 20 },
    ],
    members: [
      { id: 7, name: "Fr. Dan", email: "dan@example.com" },
      { id: 8, name: "Pat", email: "pat1@example.com" },
      { id: 9, name: "Pat", email: "pat2@example.com" },
    ],
    existingNames: new Set(["john doe"]),
  };

  const header = parseCsv(buildContactImportTemplate(config))[0] ?? [];
  const row = (values: Record<string, string>) =>
    header.map((h) => values[h] ?? "");

  it("builds contacts from a valid file", () => {
    const { contacts, errors } = validateContactImport(
      config,
      [
        header,
        row({
          Name: "Mike Smith",
          Status: "seminarian",
          "Follow-up Date": "4/2/2026",
          "Follow-up Task": "Call",
          "Assigned To": "fr. dan, pat2@example.com",
          Labels: "nspv lead",
          Starred: "Yes",
          Notes: "Hi <there>\n\nSecond",
          "Contact Information: Phone Number": "555-1234",
        }),
        row({}),
        row({ Name: "Ann Lee" }),
      ],
      context,
    );
    expect(errors).toEqual([]);
    expect(contacts).toEqual([
      {
        row: 2,
        title: "Mike Smith",
        listId: 3,
        dueDate: "2026-04-02",
        description: "<p>Hi &lt;there&gt;</p><p>Second</p>",
        labelIds: [200],
        memberIds: [7, 9],
        customData: {
          sidebar: { followUpTask: "Call" },
          meta: { starred: true },
          contact: { phone: "555-1234" },
        },
      },
      {
        row: 4,
        title: "Ann Lee",
        listId: 1,
        dueDate: null,
        description: "",
        labelIds: [],
        memberIds: [],
        customData: null,
      },
    ]);
  });

  it("reports every error and returns no contacts for bad rows", () => {
    const { contacts, errors } = validateContactImport(
      config,
      [
        [...header, "Created", "Follow up date"],
        row({ Name: "John Doe" }),
        row({ Name: "Ann", Status: "Nope", "Follow-up Date": "tomorrow" }),
        row({ Name: "ann", "Assigned To": "Pat" }),
      ],
      context,
    );
    expect(contacts).toEqual([]);
    expect(errors).toEqual([
      { row: 1, column: "Follow up date", message: 'Unknown column. Did you mean "Follow-up Date"?' },
      { row: 2, column: "Name", message: '"John Doe" is already a contact.' },
      {
        row: 3,
        column: "Status",
        message:
          '"Nope" isn\'t a status. Use one of: Prospective Discerners, Discerners, Seminarians',
      },
      {
        row: 3,
        column: "Follow-up Date",
        message: '"tomorrow" isn\'t a date (use YYYY-MM-DD or M/D/YYYY)',
      },
      { row: 4, column: "Name", message: '"ann" is also on row 3.' },
      {
        row: 4,
        column: "Assigned To",
        message: 'More than one team member is named "Pat"; use their email.',
      },
    ]);
  });

  it("ignores the export's Created and Link columns", () => {
    const { ignoredColumns, errors } = validateContactImport(
      config,
      [[...header, "Created", "Link"], [...row({ Name: "Ann" }), "2026-01-01", "http://x"]],
      context,
    );
    expect(errors).toEqual([]);
    expect(ignoredColumns).toEqual(["Created", "Link"]);
  });

  it("needs a Name column", () => {
    const { errors } = validateContactImport(config, [["Status"], ["Discerners"]], context);
    expect(errors[0]?.column).toBe("Name");
  });
});

describe("zonedMidnightToUtc", () => {
  it("is local midnight in the time zone, across DST", () => {
    expect(zonedMidnightToUtc("2026-01-15", "America/New_York").toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    );
    expect(zonedMidnightToUtc("2026-07-15", "America/New_York").toISOString()).toBe(
      "2026-07-15T04:00:00.000Z",
    );
    expect(zonedMidnightToUtc("2026-03-08", "America/Chicago").toISOString()).toBe(
      "2026-03-08T06:00:00.000Z",
    );
  });
});
