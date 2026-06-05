import type { Issue } from "../models/Issue";

const formatFieldValue = (val: unknown): string => {
  if (val === null || val === undefined) return "-";
  if (typeof val === "string") return val;
  if (typeof val === "number") return val.toString();
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) {
    return val.map((v) => formatFieldValue(v)).join(", ");
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (obj.value !== undefined) return formatFieldValue(obj.value);
    if (obj.name !== undefined) return formatFieldValue(obj.name);
    if (obj.displayName !== undefined) return formatFieldValue(obj.displayName);
    if (obj.content && Array.isArray(obj.content)) {
      return "[Rich Text]";
    }
    return JSON.stringify(val);
  }
  return String(val);
};

export const getSortValue = (issue: Issue, colId: string): string | number => {
  if (colId === "key") {
    return issue.key || "";
  }
  if (colId === "summary") {
    return issue.summary || "";
  }
  if (colId === "status") {
    return issue.status || "";
  }
  if (colId === "assignee") {
    return issue.assignee || "";
  }
  if (colId === "reporter") {
    return issue.reporter || "";
  }
  if (colId === "created") {
    return issue.created ? new Date(issue.created).getTime() : 0;
  }
  if (colId === "updated") {
    return issue.updated ? new Date(issue.updated).getTime() : 0;
  }
  if (colId === "priority") {
    return issue.priority || "";
  }

  // Custom or other fields
  const rawVal = issue.customFields
    ? issue.customFields[colId]
    : (issue as unknown as Record<string, unknown>)[colId];

  if (rawVal === null || rawVal === undefined) return "";
  if (typeof rawVal === "string") return rawVal;
  if (typeof rawVal === "number") return rawVal;
  if (typeof rawVal === "boolean") return rawVal ? 1 : 0;

  return formatFieldValue(rawVal);
};

export const compareValues = (aVal: unknown, bVal: unknown): number => {
  if (typeof aVal === "number" && typeof bVal === "number") {
    return aVal - bVal;
  }
  const aStr = String(aVal ?? "");
  const bStr = String(bVal ?? "");
  return aStr.localeCompare(bStr, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

export const sortIssues = (
  issuesList: Issue[],
  colId: string,
  direction: "asc" | "desc",
): Issue[] => {
  return [...issuesList].sort((a, b) => {
    const aVal = getSortValue(a, colId);
    const bVal = getSortValue(b, colId);
    const cmp = compareValues(aVal, bVal);
    return direction === "asc" ? cmp : -cmp;
  });
};
