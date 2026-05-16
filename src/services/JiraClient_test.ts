import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getIssuesByFilter } from "./JiraClient";

describe("JiraClient", () => {
  const mockConfig = {
    apiToken: "test-token",
    userEmail: "test@example.com",
    jiraDomain: "test-domain.atlassian.net",
    useProxy: false,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should fetch issues and map them correctly", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        issues: [
          {
            id: "1001",
            key: "TEST-1",
            fields: {
              summary: "Test Issue",
              status: { name: "In Progress" },
              assignee: { displayName: "John Doe" },
              reporter: { displayName: "Jane Doe" },
              issuelinks: [],
            },
          },
        ],
      }),
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const issues = await getIssuesByFilter(mockConfig, "10001");

    expect(fetch).toHaveBeenCalledWith(
      "https://test-domain.atlassian.net/rest/api/3/search/jql?jql=filter%3D10001&fields=summary,status,assignee,reporter,issuelinks",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${btoa("test@example.com:test-token")}`,
        }),
      }),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual({
      id: "1001",
      key: "TEST-1",
      summary: "Test Issue",
      status: "In Progress",
      assignee: "John Doe",
      reporter: "Jane Doe",
      url: "https://test-domain.atlassian.net/browse/TEST-1",
      blockingIssues: undefined,
    });
  });

  it("should map blocking issues correctly", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        issues: [
          {
            id: "1001",
            key: "TEST-1",
            fields: {
              summary: "Main Issue",
              status: { name: "In Progress" },
              issuelinks: [
                {
                  id: "link-1",
                  type: { name: "Blocks" },
                  inwardIssue: {
                    id: "1002",
                    key: "BLOCK-1",
                    fields: {
                      summary: "Blocking Issue",
                      status: { name: "Open" },
                    },
                  },
                },
                {
                  id: "link-2",
                  type: { name: "Relates" },
                  inwardIssue: {
                    id: "1003",
                    key: "REL-1",
                    fields: {
                      summary: "Related Issue",
                      status: { name: "Open" },
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const issues = await getIssuesByFilter(mockConfig, "TEST-1");

    expect(issues[0].blockingIssues).toHaveLength(1);
    expect(issues[0].blockingIssues![0]).toEqual({
      id: "1002",
      key: "BLOCK-1",
      summary: "Blocking Issue",
      status: "Open",
      url: "https://test-domain.atlassian.net/browse/BLOCK-1",
    });
  });

  it("should format JQL queries properly when they are not numbers", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ issues: [] }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await getIssuesByFilter(mockConfig, "project = TEST");

    expect(fetch).toHaveBeenCalledWith(
      "https://test-domain.atlassian.net/rest/api/3/search/jql?jql=project%20%3D%20TEST&fields=summary,status,assignee,reporter,issuelinks",
      expect.any(Object),
    );
  });

  it("should throw an error on failed response", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid token",
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(getIssuesByFilter(mockConfig, "10001")).rejects.toThrow(
      "Jira API Error: 401 Unauthorized - Invalid token",
    );
  });
});
