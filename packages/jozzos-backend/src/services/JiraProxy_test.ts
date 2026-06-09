import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createJiraProxy } from "./JiraProxy";
import type { IncomingMessage, ServerResponse } from "node:http";

describe("JiraProxy", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should forward a GET request to the target Jira domain", async () => {
    const mockResponse = {
      status: 200,
      headers: new Map([["content-type", "application/json"]]),
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify({ ok: true })).buffer,
      body: true,
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const proxy = createJiraProxy({
      defaultJiraDomain: "my-domain.atlassian.net",
      apiPrefix: "/api/jira",
    });

    // Mock request
    const req = {
      url: "/api/jira/rest/api/3/search",
      method: "GET",
      headers: {
        "x-jira-domain": "custom-domain.atlassian.net",
        authorization: "Basic abc",
      },
      [Symbol.asyncIterator]: async function* () {},
    } as unknown as IncomingMessage;

    // Mock response
    const writtenHeaders: Record<string, string> = {};
    let endCalled = false;
    let endData: Buffer | undefined;

    const res = {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        writtenHeaders[name] = value;
      },
      end: (data?: Buffer) => {
        endCalled = true;
        endData = data;
      },
    } as unknown as ServerResponse;

    await proxy(req, res);

    expect(fetch).toHaveBeenCalledWith(
      "https://custom-domain.atlassian.net/rest/api/3/search",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          host: "custom-domain.atlassian.net",
          origin: "https://custom-domain.atlassian.net",
          authorization: "Basic abc",
        }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(writtenHeaders["content-type"]).toBe("application/json");
    expect(endCalled).toBe(true);
    expect(JSON.parse(endData!.toString())).toEqual({ ok: true });
  });

  it("should strip content-encoding, content-length, and transfer-encoding headers from the response", async () => {
    const mockResponse = {
      status: 200,
      headers: new Map([
        ["content-type", "application/json"],
        ["content-encoding", "gzip"],
        ["content-length", "100"],
        ["transfer-encoding", "chunked"],
      ]),
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify({ ok: true })).buffer,
      body: true,
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const proxy = createJiraProxy({
      defaultJiraDomain: "my-domain.atlassian.net",
      apiPrefix: "/api/jira",
    });

    const req = {
      url: "/api/jira/rest/api/3/search",
      method: "GET",
      headers: {},
      [Symbol.asyncIterator]: async function* () {},
    } as unknown as IncomingMessage;

    const writtenHeaders: Record<string, string> = {};
    const res = {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        writtenHeaders[name] = value;
      },
      end: () => {},
    } as unknown as ServerResponse;

    await proxy(req, res);

    expect(writtenHeaders["content-type"]).toBe("application/json");
    expect(writtenHeaders["content-encoding"]).toBeUndefined();
    expect(writtenHeaders["content-length"]).toBeUndefined();
    expect(writtenHeaders["transfer-encoding"]).toBeUndefined();
  });

  it("should map x-jira-authorization header to authorization header and strip x-jira-authorization", async () => {
    const mockResponse = {
      status: 200,
      headers: new Map([["content-type", "application/json"]]),
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify({ ok: true })).buffer,
      body: true,
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const proxy = createJiraProxy({
      defaultJiraDomain: "my-domain.atlassian.net",
      apiPrefix: "/api/jira",
    });

    const req = {
      url: "/api/jira/rest/api/3/search",
      method: "GET",
      headers: {
        "x-jira-authorization": "Basic abc",
      },
      [Symbol.asyncIterator]: async function* () {},
    } as unknown as IncomingMessage;

    const res = {
      statusCode: 200,
      setHeader: () => {},
      end: () => {},
    } as unknown as ServerResponse;

    await proxy(req, res);

    expect(fetch).toHaveBeenCalledWith(
      "https://my-domain.atlassian.net/rest/api/3/search",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Basic abc",
        }),
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://my-domain.atlassian.net/rest/api/3/search",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "x-jira-authorization": expect.any(String),
        }),
      }),
    );
  });
});
