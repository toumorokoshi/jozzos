import { describe, it, expect } from "vitest";
import { matchIssue } from "./filtering";
import type { Issue } from "../models/Issue";

describe("filtering utilities", () => {
  const issue1: Issue = {
    id: "1",
    key: "PROJ-10",
    summary: "Refactor database access layer",
    status: "In Progress",
    assignee: "Alice Smith",
    reporter: "Charlie Brown",
    url: "https://jira.example.com/browse/PROJ-10",
    created: "2026-05-18T10:00:00.000Z",
    updated: "2026-05-20T10:00:00.000Z",
    description: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This task covers the Postgres migration." },
          ],
        },
      ],
    },
    customFields: {
      customfield_10010: "Sprint 2",
      customfield_10020: 42,
    },
    blockingIssues: [
      {
        id: "2",
        key: "PROJ-2",
        summary: "Setup database server instance",
        status: "Done",
        url: "https://jira.example.com/browse/PROJ-2",
      },
    ],
  };

  it("should match when query is empty or whitespace", () => {
    expect(matchIssue(issue1, "")).toBe(true);
    expect(matchIssue(issue1, "   ")).toBe(true);
  });

  it("should match substring on core string fields case-insensitively", () => {
    // summary
    expect(matchIssue(issue1, "database")).toBe(true);
    expect(matchIssue(issue1, "DATABASE")).toBe(true);
    expect(matchIssue(issue1, "refactor")).toBe(true);
    // key
    expect(matchIssue(issue1, "PROJ-10")).toBe(true);
    expect(matchIssue(issue1, "proj-10")).toBe(true);
    // assignee
    expect(matchIssue(issue1, "smith")).toBe(true);
    // status
    expect(matchIssue(issue1, "progress")).toBe(true);
  });

  it("should match substring on custom fields", () => {
    // string custom field
    expect(matchIssue(issue1, "Sprint")).toBe(true);
    // numeric custom field
    expect(matchIssue(issue1, "42")).toBe(true);
  });

  it("should match substring inside rich text description", () => {
    expect(matchIssue(issue1, "Postgres")).toBe(true);
    expect(matchIssue(issue1, "migration")).toBe(true);
    expect(matchIssue(issue1, "nonexistent")).toBe(false);
  });

  it("should NOT match based on blocker/relationship issue fields", () => {
    // Blocker issue 2 has summary "Setup database server instance" and key "PROJ-2"
    // Neither of these exist in parent issue1's own fields (issue1 summary has "database" but not "server" or "instance" or "PROJ-2")
    expect(matchIssue(issue1, "PROJ-2")).toBe(false);
    expect(matchIssue(issue1, "server")).toBe(false);
    expect(matchIssue(issue1, "instance")).toBe(false);
  });
});
