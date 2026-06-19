import type { Issue } from "jozzos-backend";

export const formatFieldValue = (val: unknown): string => {
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

export const getIssueFieldValue = (issue: Issue, fieldId: string): string => {
  let rawValue = issue.customFields?.[fieldId];
  if (rawValue === undefined || rawValue === null) {
    if (fieldId in issue) {
      rawValue = issue[fieldId as keyof Issue];
    }
  }
  return formatFieldValue(rawValue);
};

export const groupIssuesByField = (
  issues: Issue[],
  fieldId: string,
): Record<string, Issue[]> => {
  const groups: Record<string, Issue[]> = {};
  issues.forEach((issue) => {
    const val = getIssueFieldValue(issue, fieldId);
    if (!groups[val]) {
      groups[val] = [];
    }
    groups[val].push(issue);
  });
  return groups;
};

export const sortFieldValues = (values: string[]): string[] => {
  return [...values].sort((a, b) => {
    if (a === "-") return 1;
    if (b === "-") return -1;
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
};
