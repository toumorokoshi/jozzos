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
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIssue(null);
      }
    };
    if (selectedIssue) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIssue]);

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
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "80px",
                    textAlign: "center",
                  }}
                >
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={7}
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
                    colSpan={7}
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
                              aria-label={
                                expandedIssues.has(issue.id)
                                  ? "Collapse blockers"
                                  : "Expand blockers"
                              }
                              title={
                                expandedIssues.has(issue.id)
                                  ? "Collapse blockers"
                                  : "Expand blockers"
                              }
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--accent-secondary)",
                                cursor: "pointer",
                                padding: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s ease",
                                transform: expandedIssues.has(issue.id)
                                  ? "rotate(90deg)"
                                  : "rotate(0deg)",
                                borderRadius: "4px",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  "rgba(102, 252, 241, 0.1)";
                                e.currentTarget.style.color =
                                  "var(--text-primary)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "none";
                                e.currentTarget.style.color =
                                  "var(--accent-secondary)";
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.5"
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
                      <td
                        style={{
                          padding: "0.5rem 1rem",
                          textAlign: "center",
                        }}
                      >
                        <button
                          onClick={() => setSelectedIssue(issue)}
                          aria-label="View issue details"
                          title="View details"
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "var(--accent-secondary)",
                            cursor: "pointer",
                            padding: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "6px",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "rgba(102, 252, 241, 0.15)";
                            e.currentTarget.style.borderColor =
                              "var(--accent-secondary)";
                            e.currentTarget.style.boxShadow =
                              "0 0 10px rgba(102, 252, 241, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              "rgba(255, 255, 255, 0.05)";
                            e.currentTarget.style.borderColor =
                              "rgba(255, 255, 255, 0.1)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
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
                          <td colSpan={3}></td>
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
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleUp {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      {/* Dismissable Lightbox for Issue Details */}
      {selectedIssue && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(11, 12, 16, 0.7)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            boxSizing: "border-box",
            animation: "modalFadeIn 0.3s ease-out forwards",
          }}
          onClick={() => setSelectedIssue(null)}
        >
          <div
            style={{
              background: "rgba(31, 40, 51, 0.95)",
              border: "1px solid rgba(102, 252, 241, 0.15)",
              borderRadius: "16px",
              boxShadow:
                "0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 1px 1px rgba(255, 255, 255, 0.1)",
              width: "95vw",
              maxWidth: "1350px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation:
                "modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div
              style={{
                padding: "1.5rem",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "rgba(11, 12, 16, 0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      background: "rgba(102, 252, 241, 0.15)",
                      color: "var(--accent-secondary)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      letterSpacing: "0.05em",
                      border: "1px solid rgba(102, 252, 241, 0.3)",
                    }}
                  >
                    {selectedIssue.key}
                  </span>
                  <a
                    href={selectedIssue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--accent-secondary)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.8rem",
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "0.8")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    Open in Jira
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </a>
                </div>
                <h2
                  style={{
                    fontSize: "1.5rem",
                    color: "var(--text-primary)",
                    margin: 0,
                    fontWeight: "600",
                  }}
                >
                  {selectedIssue.summary}
                </h2>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                aria-label="Close details"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  transition: "all var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.transform = "rotate(90deg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.transform = "rotate(0deg)";
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Lightbox Content Body */}
            <div
              style={{
                padding: "1.5rem",
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "1fr 300px",
                gap: "2rem",
                flex: 1,
              }}
            >
              {/* Main Details (Left Side) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                {/* Dependencies Section */}
                {((selectedIssue.blockedBy &&
                  selectedIssue.blockedBy.length > 0) ||
                  (selectedIssue.blocks &&
                    selectedIssue.blocks.length > 0)) && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.5rem",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "0.85rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        paddingBottom: "0.25rem",
                      }}
                    >
                      Issue Dependencies
                    </h3>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(320px, 1fr))",
                        gap: "1.5rem",
                      }}
                    >
                      {/* Blocked By Column */}
                      <div>
                        <h4
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            color: "#ff6b6b",
                            marginBottom: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="3"
                              y="11"
                              width="18"
                              height="11"
                              rx="2"
                              ry="2"
                            ></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          Blocked By ({selectedIssue.blockedBy?.length || 0})
                        </h4>

                        {selectedIssue.blockedBy &&
                        selectedIssue.blockedBy.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                          >
                            {selectedIssue.blockedBy.map((dep) => (
                              <div
                                key={dep.id}
                                style={{
                                  background: "rgba(255, 107, 107, 0.03)",
                                  border: "1px solid rgba(255, 107, 107, 0.15)",
                                  borderRadius: "8px",
                                  padding: "0.75rem",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "1rem",
                                  transition:
                                    "background 0.2s, border-color 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    "rgba(255, 107, 107, 0.08)";
                                  e.currentTarget.style.borderColor =
                                    "rgba(255, 107, 107, 0.3)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    "rgba(255, 107, 107, 0.03)";
                                  e.currentTarget.style.borderColor =
                                    "rgba(255, 107, 107, 0.15)";
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <a
                                    href={dep.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: "#ff6b6b",
                                      textDecoration: "none",
                                      fontSize: "0.85rem",
                                      fontWeight: "600",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {dep.key}
                                  </a>
                                  <span
                                    style={{
                                      color: "var(--text-primary)",
                                      fontSize: "0.85rem",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {dep.summary}
                                  </span>
                                </div>
                                <span
                                  style={{
                                    background: "rgba(255, 107, 107, 0.15)",
                                    color: "#ff8787",
                                    padding: "0.15rem 0.45rem",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    fontWeight: "700",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {dep.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontStyle: "italic",
                              fontSize: "0.85rem",
                              padding: "0.5rem 0",
                            }}
                          >
                            No blockers.
                          </div>
                        )}
                      </div>

                      {/* Blocks Column */}
                      <div>
                        <h4
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            color: "#4dabf7",
                            marginBottom: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="3"
                              y="11"
                              width="18"
                              height="11"
                              rx="2"
                              ry="2"
                            ></rect>
                            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                          </svg>
                          Blocks ({selectedIssue.blocks?.length || 0})
                        </h4>

                        {selectedIssue.blocks &&
                        selectedIssue.blocks.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                          >
                            {selectedIssue.blocks.map((dep) => (
                              <div
                                key={dep.id}
                                style={{
                                  background: "rgba(77, 171, 247, 0.03)",
                                  border: "1px solid rgba(77, 171, 247, 0.15)",
                                  borderRadius: "8px",
                                  padding: "0.75rem",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "1rem",
                                  transition:
                                    "background 0.2s, border-color 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    "rgba(77, 171, 247, 0.08)";
                                  e.currentTarget.style.borderColor =
                                    "rgba(77, 171, 247, 0.3)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    "rgba(77, 171, 247, 0.03)";
                                  e.currentTarget.style.borderColor =
                                    "rgba(77, 171, 247, 0.15)";
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <a
                                    href={dep.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: "#4dabf7",
                                      textDecoration: "none",
                                      fontSize: "0.85rem",
                                      fontWeight: "600",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {dep.key}
                                  </a>
                                  <span
                                    style={{
                                      color: "var(--text-primary)",
                                      fontSize: "0.85rem",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {dep.summary}
                                  </span>
                                </div>
                                <span
                                  style={{
                                    background: "rgba(77, 171, 247, 0.15)",
                                    color: "#a5d8ff",
                                    padding: "0.15rem 0.45rem",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    fontWeight: "700",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {dep.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontStyle: "italic",
                              fontSize: "0.85rem",
                              padding: "0.5rem 0",
                            }}
                          >
                            Doesn't block other issues.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3
                    style={{
                      fontSize: "0.85rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-secondary)",
                      marginBottom: "0.5rem",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      paddingBottom: "0.25rem",
                    }}
                  >
                    Description
                  </h3>
                  <div
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                      padding: "0.5rem 0",
                    }}
                  >
                    {selectedIssue.description ? (
                      renderADFContent(selectedIssue.description)
                    ) : (
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontStyle: "italic",
                        }}
                      >
                        No description provided.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Info (Right Side) */}
              <div
                style={{
                  background: "rgba(11, 12, 16, 0.3)",
                  borderLeft: "1px solid var(--border-color)",
                  paddingLeft: "1.5rem",
                  marginLeft: "-0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                }}
              >
                {/* Status */}
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-secondary)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Status
                  </span>
                  <span
                    style={{
                      background: "var(--accent-primary)",
                      color: "var(--bg-primary)",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      display: "inline-block",
                      boxShadow: "0 2px 10px rgba(69, 162, 158, 0.2)",
                    }}
                  >
                    {selectedIssue.status}
                  </span>
                </div>

                {/* Priority */}
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-secondary)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Priority
                  </span>
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "0.95rem",
                      fontWeight: "500",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--accent-secondary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    {selectedIssue.priority || "Medium"}
                  </span>
                </div>

                {/* Assignee */}
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-secondary)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Assignee
                  </span>
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "0.95rem",
                      fontWeight: "500",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(102, 252, 241, 0.15)",
                        color: "var(--accent-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        border: "1px solid rgba(102, 252, 241, 0.3)",
                      }}
                    >
                      {selectedIssue.assignee
                        ? selectedIssue.assignee.charAt(0)
                        : "?"}
                    </div>
                    {selectedIssue.assignee || "Unassigned"}
                  </span>
                </div>

                {/* Reporter */}
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-secondary)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    Reporter
                  </span>
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "0.95rem",
                      fontWeight: "500",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {selectedIssue.reporter
                        ? selectedIssue.reporter.charAt(0)
                        : "?"}
                    </div>
                    {selectedIssue.reporter || "-"}
                  </span>
                </div>

                {/* Dates */}
                <div
                  style={{
                    marginTop: "1.5rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ marginBottom: "0.75rem" }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-secondary)",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Created
                    </span>
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatDate(selectedIssue.created)}
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-secondary)",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Updated
                    </span>
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatDate(selectedIssue.updated)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Helper Functions for ADF (Atlassian Document Format) & Dates ---

interface ADFNode {
  type?: string;
  text?: string;
  content?: ADFNode[];
  marks?: Array<{ type: string; attrs?: Record<string, string> }>;
  attrs?: { level?: number };
}

const renderADFContent = (doc: ADFNode | unknown): React.ReactNode => {
  if (!doc) return null;
  if (typeof doc === "string") return <span>{doc}</span>;

  const node = doc as ADFNode;
  if (node.type === "text") {
    let element: React.ReactNode = node.text || "";
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "strong") element = <strong>{element}</strong>;
        if (mark.type === "em") element = <em>{element}</em>;
        if (mark.type === "strike") element = <del>{element}</del>;
        if (mark.type === "underline")
          element = <u style={{ textDecoration: "underline" }}>{element}</u>;
        if (mark.type === "code") {
          element = (
            <code
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontFamily: "monospace",
                fontSize: "0.9em",
              }}
            >
              {element}
            </code>
          );
        }
      }
    }
    return element;
  }
  if (node.content && Array.isArray(node.content)) {
    const children = node.content.map((child: ADFNode, idx: number) => (
      <React.Fragment key={idx}>{renderADFContent(child)}</React.Fragment>
    ));

    switch (node.type) {
      case "paragraph":
        return (
          <p style={{ margin: "0.5rem 0", lineHeight: "1.5" }}>{children}</p>
        );
      case "heading": {
        const Level = `h${node.attrs?.level || 3}`;
        const headingStyles: React.CSSProperties = {
          margin: "1.25rem 0 0.5rem",
          fontWeight: "600",
          color: "var(--text-primary)",
        };
        return React.createElement(Level, { style: headingStyles }, children);
      }
      case "bulletList":
        return (
          <ul style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
            {children}
          </ul>
        );
      case "orderedList":
        return (
          <ol style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
            {children}
          </ol>
        );
      case "listItem":
        return <li style={{ marginBottom: "0.25rem" }}>{children}</li>;
      case "codeBlock":
        return (
          <pre
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              overflowX: "auto",
              fontFamily: "monospace",
              border: "1px solid var(--border-color)",
              margin: "0.75rem 0",
            }}
          >
            <code>{children}</code>
          </pre>
        );
      case "blockquote":
        return (
          <blockquote
            style={{
              borderLeft: "4px solid var(--accent-secondary)",
              paddingLeft: "1rem",
              margin: "0.75rem 0",
              color: "var(--text-secondary)",
              fontStyle: "italic",
            }}
          >
            {children}
          </blockquote>
        );
      default:
        return children;
    }
  }
  return null;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};
