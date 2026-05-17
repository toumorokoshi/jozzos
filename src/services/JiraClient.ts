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
    description?: unknown;
    priority?: { name?: string };
    created?: string;
    updated?: string;
    [key: string]: unknown;
  };
}

export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  navigable: boolean;
  searchable: boolean;
}

export const getIssuesByFilter = async (
  config: IssueTrackerConfig,
  filterIdOrJql: string,
  extraFields?: string[],
): Promise<Issue[]> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;

  let jql = filterIdOrJql;
  // If input is purely digits, treat it as a filter ID
  if (/^\d+$/.test(filterIdOrJql)) {
    jql = `filter=${filterIdOrJql}`;
  }

  const defaultFields = [
    "summary",
    "status",
    "assignee",
    "reporter",
    "issuelinks",
    "description",
    "priority",
    "created",
    "updated",
  ];
  const fieldsSet = new Set([...defaultFields, ...(extraFields || [])]);
  const fieldsParam = Array.from(fieldsSet).join(",");

  const url = `${baseUri}/rest/api/3/search/jql?jql=${encodeURIComponent(
    jql,
  )}&fields=${fieldsParam}`;

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

  return (data.issues as JiraIssueResponse[]).map(
    (issue: JiraIssueResponse) => {
      const blockedBy: Issue[] = [];
      const blocks: Issue[] = [];

      (issue.fields?.issuelinks || []).forEach((link: JiraIssueLink) => {
        const typeName = (link.type?.name || "").toLowerCase();
        const inwardDesc = (link.type?.inward || "").toLowerCase();
        const outwardDesc = (link.type?.outward || "").toLowerCase();

        // Check for blockedBy (current issue is blocked by inwardIssue)
        if (link.inwardIssue) {
          if (
            typeName === "blocks" ||
            inwardDesc.includes("blocked by") ||
            inwardDesc.includes("is blocked by")
          ) {
            const inward = link.inwardIssue;
            blockedBy.push({
              id: inward.id,
              key: inward.key,
              summary: inward.fields?.summary || "No Summary",
              status: inward.fields?.status?.name || "Unknown",
              url: `https://${config.jiraDomain}/browse/${inward.key}`,
            });
          }
        }

        // Check for blocks (current issue blocks outwardIssue)
        if (link.outwardIssue) {
          if (
            typeName === "blocks" ||
            outwardDesc.includes("blocks") ||
            outwardDesc.includes("block")
          ) {
            const outward = link.outwardIssue;
            blocks.push({
              id: outward.id,
              key: outward.key,
              summary: outward.fields?.summary || "No Summary",
              status: outward.fields?.status?.name || "Unknown",
              url: `https://${config.jiraDomain}/browse/${outward.key}`,
            });
          }
        }
      });

      const customFields: Record<string, unknown> = {};
      if (issue.fields) {
        Object.entries(issue.fields).forEach(([k, v]) => {
          customFields[k] = v;
        });
      }

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields?.summary || "No Summary",
        status: issue.fields?.status?.name || "Unknown",
        assignee: issue.fields?.assignee?.displayName,
        reporter: issue.fields?.reporter?.displayName,
        url: `https://${config.jiraDomain}/browse/${issue.key}`,
        blockingIssues: blockedBy.length > 0 ? blockedBy : undefined,
        blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
        blocks: blocks.length > 0 ? blocks : undefined,
        description: issue.fields?.description,
        priority: issue.fields?.priority?.name,
        created: issue.fields?.created,
        updated: issue.fields?.updated,
        customFields,
      };
    },
  );
};

export const getJiraFields = async (
  config: IssueTrackerConfig,
): Promise<JiraField[]> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;
  const url = `${baseUri}/rest/api/3/field`;

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

  return await response.json();
};

export const updateIssueFields = async (
  config: IssueTrackerConfig,
  issueIdOrKey: string,
  fields: Record<string, unknown>,
): Promise<void> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;
  const url = `${baseUri}/rest/api/3/issue/${issueIdOrKey}`;

  const headers = getAuthHeaders(config) as Record<string, string>;
  if (useProxy && config.jiraDomain) {
    headers["x-jira-domain"] = config.jiraDomain;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jira API Error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }
};

export const getAvailableTransitions = async (
  config: IssueTrackerConfig,
  issueIdOrKey: string,
): Promise<{ id: string; name: string }[]> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;
  const url = `${baseUri}/rest/api/3/issue/${issueIdOrKey}/transitions`;

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
  return (data.transitions || []).map((t: { id: string; name: string }) => ({
    id: t.id,
    name: t.name,
  }));
};

export const transitionIssue = async (
  config: IssueTrackerConfig,
  issueIdOrKey: string,
  transitionId: string,
): Promise<void> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;
  const url = `${baseUri}/rest/api/3/issue/${issueIdOrKey}/transitions`;

  const headers = getAuthHeaders(config) as Record<string, string>;
  if (useProxy && config.jiraDomain) {
    headers["x-jira-domain"] = config.jiraDomain;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ transition: { id: transitionId } }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jira API Error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }
};

export const assignIssue = async (
  config: IssueTrackerConfig,
  issueIdOrKey: string,
  accountId: string | null,
): Promise<void> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;
  const url = `${baseUri}/rest/api/3/issue/${issueIdOrKey}/assignee`;

  const headers = getAuthHeaders(config) as Record<string, string>;
  if (useProxy && config.jiraDomain) {
    headers["x-jira-domain"] = config.jiraDomain;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ accountId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jira API Error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }
};

export const searchJiraUsers = async (
  config: IssueTrackerConfig,
  query: string,
): Promise<{ accountId: string; displayName: string }[]> => {
  const useProxy = config.useProxy !== false;
  const baseUri = useProxy ? "/api/jira" : `https://${config.jiraDomain}`;
  const url = `${baseUri}/rest/api/3/user/search?query=${encodeURIComponent(
    query,
  )}`;

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

  return await response.json();
};
