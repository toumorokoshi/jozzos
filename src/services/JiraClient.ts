import type { Issue, IssueTrackerConfig } from "../models/Issue";

const getAuthHeaders = (config: IssueTrackerConfig): HeadersInit => {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (config.apiToken) {
    if (config.userEmail) {
      // Basic Auth
      const encoded = btoa(`${config.userEmail}:${config.apiToken}`);
      headers["Authorization"] = `Basic ${encoded}`;
    } else {
      // Bearer Token
      headers["Authorization"] = `Bearer ${config.apiToken}`;
    }
  }

  return headers;
};

export const getIssuesByFilter = async (
  config: IssueTrackerConfig,
  filterIdOrJql: string,
): Promise<Issue[]> => {
  const baseUri = config.useProxy !== false ? "/api/jira" : "";

  let jql = filterIdOrJql;
  // If input is purely digits, treat it as a filter ID
  if (/^\d+$/.test(filterIdOrJql)) {
    jql = `filter=${filterIdOrJql}`;
  }

  const url = `${baseUri}/rest/api/3/search?jql=${encodeURIComponent(jql)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(config),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jira API Error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();

  return data.issues.map(
    (issue: {
      id: string;
      key: string;
      fields?: {
        summary?: string;
        status?: { name?: string };
        assignee?: { displayName?: string };
        reporter?: { displayName?: string };
      };
    }) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields?.summary || "No Summary",
      status: issue.fields?.status?.name || "Unknown",
      assignee: issue.fields?.assignee?.displayName,
      reporter: issue.fields?.reporter?.displayName,
      url: `/browse/${issue.key}`, // Appended onto the base Jira URL in the UI
    }),
  );
};
