import React, { useState } from "react";
import { getIssuesByFilter } from "../services/JiraClient";
import type { Issue } from "../models/Issue";
import { useConfig } from "../context/ConfigContext";

const MAX_HISTORY_LENGTH = 1000;

export const IssuesPage: React.FC = () => {
  const { apiKey, userEmail, jiraDomain } = useConfig();
  const [filterId, setFilterId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const toggleExpand = (issueId: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const [queryHistory, setQueryHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem("jozzos_query_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse query history", e);
      }
    }
    return [];
  });

  const addToHistory = (query: string) => {
    setQueryHistory((prev) => {
      const filtered = prev.filter((q) => q !== query);
      const next = [query, ...filtered].slice(0, MAX_HISTORY_LENGTH);
      localStorage.setItem("jozzos_query_history", JSON.stringify(next));
      return next;
    });
  };

  const handleSearch = async () => {
    if (!filterId) {
      setError("Please enter a Filter ID or JQL");
      return;
    }

    if (!jiraDomain) {
      setError(
        "Jira Domain is required. Please set it in the Settings page (e.g. your-domain.atlassian.net).",
      );
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
          jiraDomain: jiraDomain,
          useProxy: true,
        },
        filterId,
      );

      setIssues(results);
      addToHistory(filterId);
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

      {/* Query History */}
      {queryHistory.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: "-0.5rem",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Recent:
          </span>
          {queryHistory.slice(0, 10).map((query, index) => (
            <button
              key={index}
              onClick={() => {
                setFilterId(query);
                // Trigger search immediately if desired
                // setTimeout(() => handleSearch(), 0);
              }}
              className="glass-panel"
              style={{
                padding: "0.25rem 0.75rem",
                fontSize: "0.75rem",
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "100px",
                color: "var(--text-secondary)",
                transition: "all var(--transition-fast)",
                whiteSpace: "nowrap",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              {query}
            </button>
          ))}
        </div>
      )}

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
                    padding: "0.5rem 0.5rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "40px",
                    textAlign: "center",
                  }}
                ></th>
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
                    colSpan={6}
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
                    colSpan={6}
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
                  <React.Fragment key={issue.id}>
                    <tr
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
                      <td
                        style={{
                          padding: "0.5rem 0.5rem",
                          textAlign: "center",
                        }}
                      >
                        {issue.blockingIssues &&
                          issue.blockingIssues.length > 0 && (
                            <button
                              onClick={() => toggleExpand(issue.id)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "transform 0.2s ease",
                                transform: expandedIssues.has(issue.id)
                                  ? "rotate(90deg)"
                                  : "rotate(0deg)",
                              }}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9 18 15 12 9 6"></polyline>
                              </svg>
                            </button>
                          )}
                      </td>
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
                    {expandedIssues.has(issue.id) &&
                      issue.blockingIssues?.map((blocker) => (
                        <tr
                          key={`${issue.id}-blocking-${blocker.id}`}
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                            background: "rgba(255, 255, 255, 0.02)",
                          }}
                        >
                          <td
                            style={{
                              padding: "0.5rem 0.5rem",
                              textAlign: "right",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ transform: "rotate(90deg) scaleX(-1)" }}
                            >
                              <path d="M9 18l6-6-6-6"></path>
                            </svg>
                          </td>
                          <td style={{ padding: "0.5rem 1rem 0.5rem 2rem" }}>
                            <a
                              href={blocker.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "var(--accent-secondary)",
                                textDecoration: "none",
                                fontSize: "0.8rem",
                                opacity: 0.8,
                              }}
                            >
                              {blocker.key}
                            </a>
                          </td>
                          <td
                            style={{
                              padding: "0.5rem 1rem",
                              color: "var(--text-secondary)",
                              fontSize: "0.8rem",
                              fontStyle: "italic",
                            }}
                          >
                            {blocker.summary}
                          </td>
                          <td style={{ padding: "0.5rem 1rem" }}>
                            <span
                              style={{
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "var(--text-secondary)",
                                padding: "0.05rem 0.4rem",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                              }}
                            >
                              {blocker.status}
                            </span>
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      ))}
                  </React.Fragment>
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
