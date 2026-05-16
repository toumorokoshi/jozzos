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

interface JiraIssueLink {
  id: string;
  type: {
    id: string;
    name: string;
    inward: string;
    outward: string;
  };
  inwardIssue?: {
    id: string;
    key: string;
    fields?: {
      summary?: string;
      status?: { name?: string };
    };
  };
  outwardIssue?: {
    id: string;
    key: string;
    fields?: {
      summary?: string;
      status?: { name?: string };
    };
  };
}

interface JiraIssueResponse {
  id: string;
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    assignee?: { displayName?: string };
    reporter?: { displayName?: string };
    issuelinks?: JiraIssueLink[];
  };
}

export const getIssuesByFilter = async (
  config: IssueTrackerConfig,
  filterIdOrJql: string,
): Promise<Issue[]> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;

  let jql = filterIdOrJql;
  // If input is purely digits, treat it as a filter ID
  if (/^\d+$/.test(filterIdOrJql)) {
    jql = `filter=${filterIdOrJql}`;
  }

  const url = `${baseUri}/rest/api/3/search/jql?jql=${encodeURIComponent(
    jql,
  )}&fields=summary,status,assignee,reporter,issuelinks`;

  const headers = getAuthHeaders(config) as Record<string, string>;
  if (useProxy && config.jiraDomain) {
    headers["x-jira-domain"] = config.jiraDomain;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jira API Error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();

  return data.issues.map((issue: JiraIssueResponse) => {
    const blockingIssues: Issue[] = (issue.fields?.issuelinks || [])
      .filter((link: JiraIssueLink) => {
        if (!link.inwardIssue) return false;
        const typeName = link.type.name.toLowerCase();
        const inwardDesc = link.type.inward.toLowerCase();
        return typeName === "blocks" || inwardDesc.includes("blocked by");
      })
      .map((link: JiraIssueLink) => {
        const inward = link.inwardIssue!;
        return {
          id: inward.id,
          key: inward.key,
          summary: inward.fields?.summary || "No Summary",
          status: inward.fields?.status?.name || "Unknown",
          url: `https://${config.jiraDomain}/browse/${inward.key}`,
        };
      });

    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields?.summary || "No Summary",
      status: issue.fields?.status?.name || "Unknown",
      assignee: issue.fields?.assignee?.displayName,
      reporter: issue.fields?.reporter?.displayName,
      url: `https://${config.jiraDomain}/browse/${issue.key}`,
      blockingIssues: blockingIssues.length > 0 ? blockingIssues : undefined,
    };
  });
};
