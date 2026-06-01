import type { Issue } from "../models/Issue";

/**
 * Checks if a value recursively contains a lowercase query string.
 * It ignores relationship fields like "blockingIssues", "blockedBy", and "blocks"
 * to avoid circular references and keep searching focused on the issue's own fields.
 */
export function hasSubstring(
  val: unknown,
  query: string,
  visited: Set<unknown> = new Set(),
): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") {
    return val.toLowerCase().includes(query);
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return val.toString().toLowerCase().includes(query);
  }
  if (typeof val === "object") {
    if (visited.has(val)) return false;
    visited.add(val);

    if (Array.isArray(val)) {
      return val.some((item) => hasSubstring(item, query, visited));
    }

    return Object.entries(val as Record<string, unknown>).some(
      ([key, value]) => {
        // Exclude relationships on the issue object
        if (
          key === "blockingIssues" ||
          key === "blockedBy" ||
          key === "blocks"
        ) {
          return false;
        }
        return hasSubstring(value, query, visited);
      },
    );
  }
  return false;
}

/**
 * Returns true if the issue matches the query string.
 * The query is compared against all fields of the issue, except relationship fields.
 */
export function matchIssue(issue: Issue, query: string): boolean {
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return true;
  return hasSubstring(issue, cleanQuery);
}
