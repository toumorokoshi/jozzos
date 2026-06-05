import { describe, it, expect } from "vitest";
import { sortIssues } from "./sorting";
import type { Issue } from "../models/Issue";

describe("sorting utilities", () => {
  const mockIssues: Issue[] = [
    {
      id: "1",
      key: "PROJ-10",
      summary: "Zebra task",
      status: "In Progress",
      assignee: "Alice",
      reporter: "Charlie",
      url: "",
      created: "2026-05-18T10:00:00.000Z",
      updated: "2026-05-20T10:00:00.000Z",
      customFields: {
        customfield_10010: "Sprint 2",
        customfield_10020: 42,
      },
    },
    {
      id: "2",
      key: "PROJ-2",
      summary: "Apple task",
      status: "To Do",
      assignee: "Bob",
      reporter: "Alice",
      url: "",
      created: "2026-05-17T10:00:00.000Z",
      updated: "2026-05-22T10:00:00.000Z",
      customFields: {
        customfield_10010: "Sprint 10",
        customfield_10020: 7,
      },
    },
    {
      id: "3",
      key: "OTHER-1",
      summary: "Banana task",
      status: "Done",
      assignee: "",
      reporter: "Bob",
      url: "",
      created: "2026-05-19T10:00:00.000Z",
      updated: "2026-05-19T10:00:00.000Z",
      customFields: {
        customfield_10010: "Sprint 1",
        customfield_10020: 100,
      },
    },
  ];

  it("should sort naturally by Jira key", () => {
    const sortedAsc = sortIssues(mockIssues, "key", "asc");
    expect(sortedAsc.map((i) => i.key)).toEqual([
      "OTHER-1",
      "PROJ-2",
      "PROJ-10",
    ]);

    const sortedDesc = sortIssues(mockIssues, "key", "desc");
    expect(sortedDesc.map((i) => i.key)).toEqual([
      "PROJ-10",
      "PROJ-2",
      "OTHER-1",
    ]);
  });

  it("should sort alphabetically by summary", () => {
    const sortedAsc = sortIssues(mockIssues, "summary", "asc");
    expect(sortedAsc.map((i) => i.summary)).toEqual([
      "Apple task",
      "Banana task",
      "Zebra task",
    ]);
  });

  it("should sort by date fields", () => {
    const sortedAsc = sortIssues(mockIssues, "created", "asc");
    expect(sortedAsc.map((i) => i.id)).toEqual(["2", "1", "3"]); // 17th, 18th, 19th
  });

  it("should sort custom text fields naturally", () => {
    const sortedAsc = sortIssues(mockIssues, "customfield_10010", "asc");
    expect(sortedAsc.map((i) => i.id)).toEqual(["3", "1", "2"]); // Sprint 1, Sprint 2, Sprint 10
  });

  it("should sort custom numeric fields", () => {
    const sortedAsc = sortIssues(mockIssues, "customfield_10020", "asc");
    expect(sortedAsc.map((i) => i.id)).toEqual(["2", "1", "3"]); // 7, 42, 100
  });

  it("should handle empty values gracefully", () => {
    const sortedAsc = sortIssues(mockIssues, "assignee", "asc");
    expect(sortedAsc.map((i) => i.assignee)).toEqual(["", "Alice", "Bob"]);
  });
});
