import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getIssuesByFilter,
  updateIssueFields,
  getAvailableTransitions,
  transitionIssue,
  assignIssue,
  searchJiraUsers,
  getJiraFields,
  addBlocker,
} from "./JiraClient";

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
              description: { type: "doc", content: [] },
              priority: { name: "High" },
              created: "2026-05-16T12:00:00.000Z",
              updated: "2026-05-16T13:00:00.000Z",
            },
          },
        ],
      }),
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const issues = await getIssuesByFilter(mockConfig, "10001");

    expect(fetch).toHaveBeenCalledWith(
      "https://test-domain.atlassian.net/rest/api/3/search/jql?jql=filter%3D10001&fields=summary,status,assignee,reporter,issuelinks,description,priority,created,updated",
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
      blockedBy: undefined,
      blocks: undefined,
      description: { type: "doc", content: [] },
      priority: "High",
      created: "2026-05-16T12:00:00.000Z",
      updated: "2026-05-16T13:00:00.000Z",
      customFields: {
        summary: "Test Issue",
        status: { name: "In Progress" },
        assignee: { displayName: "John Doe" },
        reporter: { displayName: "Jane Doe" },
        issuelinks: [],
        description: { type: "doc", content: [] },
        priority: { name: "High" },
        created: "2026-05-16T12:00:00.000Z",
        updated: "2026-05-16T13:00:00.000Z",
      },
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
                {
                  id: "link-3",
                  type: { name: "Blocks" },
                  outwardIssue: {
                    id: "1004",
                    key: "BLOCKED-1",
                    fields: {
                      summary: "Blocked Issue",
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
    expect(issues[0].blockedBy).toHaveLength(1);
    expect(issues[0].blocks).toHaveLength(1);
    expect(issues[0].blockedBy![0]).toEqual({
      id: "1002",
      key: "BLOCK-1",
      summary: "Blocking Issue",
      status: "Open",
      url: "https://test-domain.atlassian.net/browse/BLOCK-1",
    });
    expect(issues[0].blocks![0]).toEqual({
      id: "1004",
      key: "BLOCKED-1",
      summary: "Blocked Issue",
      status: "Open",
      url: "https://test-domain.atlassian.net/browse/BLOCKED-1",
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
      "https://test-domain.atlassian.net/rest/api/3/search/jql?jql=project%20%3D%20TEST&fields=summary,status,assignee,reporter,issuelinks,description,priority,created,updated",
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

  describe("updateIssueFields", () => {
    it("should send PUT request to update fields", async () => {
      const mockResponse = { ok: true };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      await updateIssueFields(mockConfig, "TEST-1", {
        summary: "Updated Summary",
      });

      expect(fetch).toHaveBeenCalledWith(
        "https://test-domain.atlassian.net/rest/api/3/issue/TEST-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ fields: { summary: "Updated Summary" } }),
        }),
      );
    });
  });

  describe("getAvailableTransitions", () => {
    it("should fetch transitions and map them", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          transitions: [
            { id: "11", name: "To Do" },
            { id: "21", name: "In Progress" },
          ],
        }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      const transitions = await getAvailableTransitions(mockConfig, "TEST-1");

      expect(fetch).toHaveBeenCalledWith(
        "https://test-domain.atlassian.net/rest/api/3/issue/TEST-1/transitions",
        expect.objectContaining({ method: "GET" }),
      );
      expect(transitions).toEqual([
        { id: "11", name: "To Do" },
        { id: "21", name: "In Progress" },
      ]);
    });
  });

  describe("transitionIssue", () => {
    it("should send POST request to transition issue", async () => {
      const mockResponse = { ok: true };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      await transitionIssue(mockConfig, "TEST-1", "21");

      expect(fetch).toHaveBeenCalledWith(
        "https://test-domain.atlassian.net/rest/api/3/issue/TEST-1/transitions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ transition: { id: "21" } }),
        }),
      );
    });
  });

  describe("assignIssue", () => {
    it("should send PUT request to assign issue", async () => {
      const mockResponse = { ok: true };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      await assignIssue(mockConfig, "TEST-1", "user-acc-id");

      expect(fetch).toHaveBeenCalledWith(
        "https://test-domain.atlassian.net/rest/api/3/issue/TEST-1/assignee",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ accountId: "user-acc-id" }),
        }),
      );
    });
  });

  describe("searchJiraUsers", () => {
    it("should send GET request to search users", async () => {
      const mockResponse = {
        ok: true,
        json: async () => [{ accountId: "123", displayName: "Alice" }],
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      const users = await searchJiraUsers(mockConfig, "Alice");

      expect(fetch).toHaveBeenCalledWith(
        "https://test-domain.atlassian.net/rest/api/3/user/search?query=Alice",
        expect.objectContaining({ method: "GET" }),
      );
      expect(users).toEqual([{ accountId: "123", displayName: "Alice" }]);
    });
  });

  describe("getJiraFields", () => {
    it("should send GET request to fetch available fields", async () => {
      const mockResponse = {
        ok: true,
        json: async () => [
          {
            id: "customfield_10010",
            name: "Sprint",
            custom: true,
            navigable: true,
            searchable: true,
          },
        ],
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      const fields = await getJiraFields(mockConfig);

      expect(fetch).toHaveBeenCalledWith(
        "https://test-domain.atlassian.net/rest/api/3/field",
        expect.objectContaining({ method: "GET" }),
      );
      expect(fields).toEqual([
        {
          id: "customfield_10010",
          name: "Sprint",
          custom: true,
          navigable: true,
          searchable: true,
        },
      ]);
    });
  });

  describe("getIssuesByFilter with extra fields", () => {
    it("should request extra fields in the search JQL parameters", async () => {
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
                customfield_10010: ["Sprint 1"],
              },
            },
          ],
        }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      const issues = await getIssuesByFilter(mockConfig, "TEST-1", [
        "customfield_10010",
      ]);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "fields=summary,status,assignee,reporter,issuelinks,description,priority,created,updated,customfield_10010",
        ),
        expect.any(Object),
      );
      expect(issues[0].customFields?.customfield_10010).toEqual(["Sprint 1"]);
    });
  });

  describe("addBlocker", () => {
    it("should send POST request to issueLink endpoint with correct payload", async () => {
      const mockResponse = { ok: true };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      await addBlocker(mockConfig, "TEST-1", "BLOCK-2");

      expect(fetch).toHaveBeenCalledWith(
        "https://test-domain.atlassian.net/rest/api/3/issueLink",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            type: { name: "Blocks" },
            inwardIssue: { key: "BLOCK-2" },
            outwardIssue: { key: "TEST-1" },
          }),
        }),
      );
    });

    it("should throw error if fetch response is not ok", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Issue keys are invalid",
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

      await expect(addBlocker(mockConfig, "TEST-1", "BLOCK-2")).rejects.toThrow(
        "Jira API Error: 400 Bad Request - Issue keys are invalid",
      );
    });
  });
});
