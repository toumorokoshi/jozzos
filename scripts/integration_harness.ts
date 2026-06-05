import { getIssuesByFilter, type IssueTrackerConfig } from "jozzos-backend";

async function run() {
  const apiKey = process.env.JIRA_API_KEY;
  const userEmail = process.env.JIRA_EMAIL;
  const hostname = process.env.JIRA_HOSTNAME;

  if (!apiKey || !userEmail || !hostname) {
    console.error("Missing required environment variables in .env");
    console.error(
      "Please ensure JIRA_API_KEY, JIRA_EMAIL, and JIRA_HOSTNAME are set.",
    );
    process.exit(1);
  }

  const config: IssueTrackerConfig = {
    apiToken: apiKey,
    userEmail: userEmail,
    useProxy: false,
  };

  // Temporarily patch fetch to prefix hostname for server-side testing,
  // since the base code expects relative URLs or proxy injection.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    let finalUrl = typeof url === "string" ? url : url.toString();
    if (finalUrl.startsWith("/")) {
      finalUrl = `https://${hostname}${finalUrl}`;
    }
    console.log(`[Integration Test] Fetching: ${finalUrl}`);
    return originalFetch(finalUrl, init);
  };

  try {
    // Basic JQL to get 1 issue just to verify connectivity
    console.log("Testing Jira API connectivity with userEmail:", userEmail);
    const issues = await getIssuesByFilter(
      config,
      "project IS NOT EMPTY order by created DESC",
    );
    console.log("Successfully fetched issues!");
    console.log(`Found ${issues.length} issues.`);
    if (issues.length > 0) {
      console.log("Sample Issue:", issues[0]);
    }
  } catch (err: unknown) {
    console.error("Integration test failed!");
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

run();
