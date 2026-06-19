import { describe, it, expect } from "vitest";
import {
  formatFieldValue,
  getIssueFieldValue,
  groupIssuesByField,
  sortFieldValues,
} from "./matrixUtils";
import type { Issue } from "jozzos-backend";

describe("matrixUtils", () => {
  describe("formatFieldValue", () => {
    it("should handle null and undefined", () => {
      expect(formatFieldValue(null)).toBe("-");
      expect(formatFieldValue(undefined)).toBe("-");
    });

    it("should handle primitive values", () => {
      expect(formatFieldValue("hello")).toBe("hello");
      expect(formatFieldValue(123)).toBe("123");
      expect(formatFieldValue(true)).toBe("Yes");
      expect(formatFieldValue(false)).toBe("No");
    });

    it("should handle arrays of values", () => {
      expect(formatFieldValue(["foo", "bar"])).toBe("foo, bar");
      expect(formatFieldValue([1, null, "baz"])).toBe("1, -, baz");
    });

    it("should extract known property names from objects", () => {
      expect(formatFieldValue({ value: "Option A" })).toBe("Option A");
      expect(formatFieldValue({ name: "Sprint 5" })).toBe("Sprint 5");
      expect(formatFieldValue({ displayName: "Jane Doe" })).toBe("Jane Doe");
    });

    it("should handle rich text objects", () => {
      expect(formatFieldValue({ content: [{ text: "yo" }] })).toBe(
        "[Rich Text]",
      );
    });

    it("should fall back to JSON stringify for other objects", () => {
      expect(formatFieldValue({ arbitrary: "prop" })).toBe(
        '{"arbitrary":"prop"}',
      );
    });
  });

  describe("getIssueFieldValue", () => {
    const mockIssue: Issue = {
      id: "1",
      key: "ABC-123",
      summary: "First task",
      status: "In Progress",
      assignee: "John",
      url: "https://jira/browse/ABC-123",
      customFields: {
        customfield_10010: "Epic Name",
        customfield_10020: { value: "High Priority" },
        status: { name: "Status from raw fields" },
      },
    };

    it("should read customFields first if available", () => {
      // even if top-level 'status' exists, customFields is checked first
      // wait, is status raw or formatted? It checks raw status object
      expect(getIssueFieldValue(mockIssue, "customfield_10010")).toBe(
        "Epic Name",
      );
      expect(getIssueFieldValue(mockIssue, "customfield_10020")).toBe(
        "High Priority",
      );
    });

    it("should fall back to top level property if not in customFields", () => {
      // summary isn't in customFields. status isn't in customFields under 'status' key (well, in our mock it is status object)
      expect(getIssueFieldValue(mockIssue, "summary")).toBe("First task");
      expect(getIssueFieldValue(mockIssue, "assignee")).toBe("John");
    });

    it("should return '-' if field is not present", () => {
      expect(getIssueFieldValue(mockIssue, "non_existent")).toBe("-");
    });
  });

  describe("groupIssuesByField", () => {
    const mockIssues: Issue[] = [
      {
        id: "1",
        key: "A-1",
        summary: "One",
        status: "To Do",
        url: "",
      },
      {
        id: "2",
        key: "A-2",
        summary: "Two",
        status: "In Progress",
        url: "",
      },
      {
        id: "3",
        key: "A-3",
        summary: "Three",
        status: "To Do",
        url: "",
        assignee: "Jane",
      },
    ];

    it("should group issues correctly", () => {
      const groups = groupIssuesByField(mockIssues, "status");
      expect(groups).toEqual({
        "To Do": [mockIssues[0], mockIssues[2]],
        "In Progress": [mockIssues[1]],
      });
    });
  });

  describe("sortFieldValues", () => {
    it("should sort values alphanumerically and push '-' to the end", () => {
      const input = ["To Do", "-", "In Progress", "Done", "10", "2"];
      const sorted = sortFieldValues(input);
      expect(sorted).toEqual(["2", "10", "Done", "In Progress", "To Do", "-"]);
    });
  });
});
