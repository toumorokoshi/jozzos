import React, { useState } from "react";
import { getIssuesByFilter } from "../services/JiraClient";
import type { Issue } from "../models/Issue";
import { useConfig } from "../context/ConfigContext";

export const IssuesPage: React.FC = () => {
  const { apiKey, userEmail } = useConfig();
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
      setError(
        "Jira Cloud requires your Email address when using an API Key (Basic Auth). Please provide your Jira Email in the Settings page.",
      );
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
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        height: "100%",
      }}
    >
      {/* Top Bar for Filter */}
      <div
        className="glass-panel"
        style={{
          padding: "1rem",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          className="input-field"
          style={{ padding: "0.5rem 1rem", flex: 1, margin: 0 }}
          placeholder="Enter Jira Filter ID or JQL (e.g. project = PROJ)"
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          className="btn-primary"
          style={{ padding: "0.5rem 1.5rem" }}
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "rgba(255, 99, 71, 0.15)",
            color: "#ff8787",
            border: "1px solid rgba(255, 99, 71, 0.3)",
            borderRadius: "6px",
            fontSize: "0.9rem",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Spreadsheet View */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.85rem",
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                background: "var(--bg-secondary)",
                zIndex: 10,
              }}
            >
              <tr>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "120px",
                  }}
                >
                  Key
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  Summary
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "150px",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "150px",
                  }}
                >
                  Assignee
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "150px",
                  }}
                >
                  Reporter
                </th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    No issues loaded yet. Enter a query to begin.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: "2rem", textAlign: "center" }}
                  >
                    <div
                      className="spinner"
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "2px solid var(--border-color)",
                        borderTop: "2px solid var(--accent-secondary)",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto",
                      }}
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                issues.map((issue) => (
                  <tr
                    key={issue.id}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      background: "rgba(11, 12, 16, 0.4)",
                      transition: "background var(--transition-fast)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(11, 12, 16, 0.8)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(11, 12, 16, 0.4)")
                    }
                  >
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <a
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--accent-secondary)",
                          textDecoration: "none",
                          fontWeight: "500",
                        }}
                      >
                        {issue.key}
                      </a>
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 1rem",
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "400px",
                      }}
                    >
                      {issue.summary}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <span
                        style={{
                          background: "var(--accent-primary)",
                          color: "var(--bg-primary)",
                          padding: "0.1rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                        }}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 1rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {issue.assignee || "-"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 1rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {issue.reporter || "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
