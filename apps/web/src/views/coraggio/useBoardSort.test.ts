import { describe, expect, it } from "vitest";

import { getCoraggioSourceCodeUrl, getListInfo } from "@kan/shared";

import {
  sortAlphabetically,
  sortByFollowUp,
  sortByLastContact,
  sortCardsBy,
} from "./useBoardSort";
import { findMatchingList } from "./findMatchingList";

const card = (
  title: string,
  dueDate: string | null = null,
  lastContacted?: string,
) => ({
  title,
  dueDate: dueDate ? new Date(dueDate) : null,
  customData: lastContacted ? { sidebar: { lastContacted } } : null,
});

const titles = (cards: { title: string }[]) => cards.map((c) => c.title);

describe("board sort", () => {
  const cards = [
    card("messy owl", "2026-09-03", "2026-06-01"),
    card("Athletic Octopus", null, "2026-09-01"),
    card("dancing rhino", "2026-10-02"),
    card("Bellamy", "2026-08-17", "2016-07-19"),
  ];

  it("sorts alphabetically, ignoring case", () => {
    expect(titles(sortAlphabetically(cards))).toEqual([
      "Athletic Octopus",
      "Bellamy",
      "dancing rhino",
      "messy owl",
    ]);
  });

  it("sorts by follow-up date, contacts without one last", () => {
    expect(titles(sortByFollowUp(cards))).toEqual([
      "Bellamy",
      "messy owl",
      "dancing rhino",
      "Athletic Octopus",
    ]);
  });

  it("sorts by last contact, longest ago first, never contacted last", () => {
    expect(titles(sortByLastContact(cards))).toEqual([
      "Bellamy",
      "messy owl",
      "Athletic Octopus",
      "dancing rhino",
    ]);
  });

  it("keeps the manual order when sorting is off", () => {
    expect(sortCardsBy(cards, null)).toBe(cards);
  });

  it("keeps the manual order among cards without a value", () => {
    const undated = [card("b"), card("a"), card("c")];
    expect(titles(sortByFollowUp(undated))).toEqual(["b", "a", "c"]);
  });
});

describe("getListInfo", () => {
  const config = { main: { listInfo: { "Future Discerners": "Too young" } } };

  it("matches the list name ignoring case", () => {
    expect(getListInfo(config, "future discerners")).toBe("Too young");
  });

  it("returns nothing for unknown lists or no config", () => {
    expect(getListInfo(config, "Discerners")).toBeUndefined();
    expect(getListInfo(null, "Discerners")).toBeUndefined();
  });
});

describe("getCoraggioSourceCodeUrl", () => {
  it("links to the commit when the build knows it", () => {
    expect(getCoraggioSourceCodeUrl("8f038104ce89fdf24cb48759d1b1c1e447eac24b")).toBe(
      "https://github.com/5-stones/kan/tree/8f038104ce89fdf24cb48759d1b1c1e447eac24b",
    );
  });

  it("falls back to the branch", () => {
    expect(getCoraggioSourceCodeUrl(undefined)).toBe(
      "https://github.com/5-stones/kan/tree/coraggio",
    );
    expect(getCoraggioSourceCodeUrl("unknown")).toBe(
      "https://github.com/5-stones/kan/tree/coraggio",
    );
  });
});

describe("findMatchingList", () => {
  const archiveLists = [
    { publicId: "a", name: "Seminarians" },
    { publicId: "b", name: "Non-candidates" },
  ];

  it("matches the same status ignoring case, punctuation and plurals", () => {
    expect(findMatchingList(archiveLists, "Seminarian")?.publicId).toBe("a");
    expect(findMatchingList(archiveLists, "seminarians")?.publicId).toBe("a");
    expect(findMatchingList(archiveLists, "Non-candidate")?.publicId).toBe("b");
    expect(findMatchingList(archiveLists, "non candidates")?.publicId).toBe("b");
  });

  it("finds nothing for other statuses", () => {
    expect(findMatchingList(archiveLists, "Discerners")).toBeUndefined();
    expect(findMatchingList(archiveLists, undefined)).toBeUndefined();
  });
});
