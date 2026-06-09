import type { IncomingMessage, ServerResponse } from "node:http";

export interface JiraProxyOptions {
  defaultJiraDomain?: string;
  apiPrefix?: string; // e.g. "/api/jira"
}

export function createJiraProxy(options: JiraProxyOptions = {}) {
  const defaultJiraDomain =
    options.defaultJiraDomain || "your-domain.atlassian.net";
  const apiPrefix = options.apiPrefix || "/api/jira";

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const hostHeader = req.headers["x-jira-domain"] as string;
      const domain = hostHeader || defaultJiraDomain;
      const targetUrl = `https://${domain}`;

      // Rewrite path: strip prefix
      let reqUrl = req.url || "";
      if (reqUrl.startsWith(apiPrefix)) {
        reqUrl = reqUrl.substring(apiPrefix.length);
      }

      const destUrl = `${targetUrl}${reqUrl}`;

      // Accumulate request body if any
      const bodyBuffers: Buffer[] = [];
      for await (const chunk of req) {
        bodyBuffers.push(Buffer.from(chunk));
      }
      const body =
        bodyBuffers.length > 0 ? Buffer.concat(bodyBuffers) : undefined;

      // Prepare headers
      const headers = { ...req.headers };
      // Host and Origin must match target for Jira Cloud
      headers["host"] = domain;
      headers["origin"] = targetUrl;
      delete headers["referer"];
      delete headers["x-jira-domain"];

      const jiraAuth = headers["x-jira-authorization"];
      if (jiraAuth) {
        headers["authorization"] = Array.isArray(jiraAuth)
          ? jiraAuth[0]
          : jiraAuth;
        delete headers["x-jira-authorization"];
      }

      // Fetch the response
      const response = await fetch(destUrl, {
        method: req.method,
        headers: headers as Record<string, string>,
        body: body,
      });

      // Write response headers and status
      res.statusCode = response.status;
      response.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase();
        // Skip transfer-encoding chunked if we're writing directly.
        // Also skip content-encoding and content-length because Node fetch automatically
        // decompresses the response, making the body plain uncompressed content (JSON).
        if (
          lowerName !== "transfer-encoding" &&
          lowerName !== "content-encoding" &&
          lowerName !== "content-length"
        ) {
          res.setHeader(name, value);
        }
      });

      // Write body to response
      if (response.body) {
        const arrayBuffer = await response.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      } else {
        res.end();
      }
    } catch (error: unknown) {
      console.error("[JiraProxy Error]:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Internal Server Error in Jira Proxy" }));
    }
  };
}
