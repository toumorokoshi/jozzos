import { useState } from "react";
import { getIssuesByFilter } from "./services/JiraClient";
import type { Issue } from "./models/Issue";

function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.JIRA_API_KEY || "");
  const [userEmail, setUserEmail] = useState(import.meta.env.JIRA_EMAIL || "");
  const [filterId, setFilterId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!filterId) {
      setError("Please enter a Filter ID or JQL");
      return;
    }
    
    if (apiKey && !userEmail) {
      setError("Jira Cloud requires your Email address when using an API Key (Basic Auth). Please provide your Jira Email.");
      return;
    }

    setLoading(true);
    setError(null);
    setIssues([]);

    try {
      const results = await getIssuesByFilter(
        {
          apiToken: apiKey,
          userEmail: userEmail,
          useProxy: true,
        },
        filterId,
      );

      setIssues(results);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred while fetching issues.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", color: "var(--accent-secondary)" }}>
          Jozzos
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--text-secondary)" }}>
          Premium Issue Tracker Client
        </p>
      </header>

      <main
        style={{ display: "grid", gap: "2rem", gridTemplateColumns: "1fr" }}
      >
        <section className="glass-panel">
          <h2>Configuration</h2>
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            Enter your API credentials to connect to your issue tracker.
          </p>
          <div
            style={{ display: "flex", gap: "1rem", flexDirection: "column" }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="Jira Email (for Basic Auth) or leave blank for Bearer Token"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
            <input
              type="password"
              className="input-field"
              placeholder="API Key / Token"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </section>

        <section className="glass-panel">
          <h2>Filter Issues</h2>
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            Enter a Jira Filter ID or JQL to list issues.
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 10001 or project = PROJ"
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              className="btn-primary"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
          {error && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "rgba(255, 99, 71, 0.2)",
                color: "#ff6b6b",
                borderRadius: "8px",
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}
        </section>

        <section className="glass-panel" style={{ minHeight: "300px" }}>
          <h2>Results</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            {issues.length > 0
              ? `Found ${issues.length} issues.`
              : "No issues loaded yet."}
          </p>

          <div style={{ display: "grid", gap: "1rem" }}>
            {issues.map((issue) => (
              <div
                key={issue.id}
                style={{
                  background: "rgba(11, 12, 16, 0.4)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  transition: "transform var(--transition-fast)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateX(5px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateX(0)")
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--accent-secondary)",
                      textDecoration: "none",
                      fontWeight: "bold",
                    }}
                  >
                    {issue.key}
                  </a>
                  <span
                    style={{
                      background: "var(--accent-primary)",
                      color: "var(--bg-primary)",
                      padding: "0.2rem 0.8rem",
                      borderRadius: "12px",
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                    }}
                  >
                    {issue.status}
                  </span>
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.2rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {issue.summary}
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                    marginTop: "0.5rem",
                  }}
                >
                  {issue.assignee && <span>👤 Assignee: {issue.assignee}</span>}
                  {issue.reporter && <span>📝 Reporter: {issue.reporter}</span>}
                </div>
              </div>
            ))}

            {loading && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "2rem",
                }}
              >
                <div
                  className="spinner"
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "4px solid var(--border-color)",
                    borderTop: "4px solid var(--accent-secondary)",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
              </div>
            )}
          </div>
        </section>
      </main>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
