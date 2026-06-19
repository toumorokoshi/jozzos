import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useConfig } from "../context/ConfigContext";
import {
  getIssuesByFilter,
  getJiraFields,
  updateIssueFields,
  assignIssue,
  searchJiraUsers,
  getAvailableTransitions,
  transitionIssue,
} from "jozzos-backend";
import type { Issue } from "jozzos-backend";
import { groupIssuesByField, sortFieldValues, getIssueFieldValue } from "../utils/matrixUtils";
import {
  RefreshCw,
  Filter,
  AlertTriangle,
  LayoutGrid,
  Search,
} from "lucide-react";

const STANDARD_FIELDS = [
  { id: "status", name: "Status" },
  { id: "assignee", name: "Assignee" },
  { id: "reporter", name: "Reporter" },
  { id: "priority", name: "Priority" },
  { id: "issuetype", name: "Issue Type" },
  { id: "project", name: "Project" },
  { id: "resolution", name: "Resolution" },
];

const isStatusClosed = (statusName: string | undefined): boolean => {
  if (!statusName) return false;
  const lower = statusName.toLowerCase();
  return (
    lower.includes("done") ||
    lower.includes("closed") ||
    lower.includes("resolved") ||
    lower.includes("complete")
  );
};

const getPriorityColor = (
  priority: string | undefined,
): { bg: string; color: string } => {
  if (!priority)
    return { bg: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" };
  const p = priority.toLowerCase();
  if (p.includes("high") || p.includes("crit") || p.includes("block")) {
    return { bg: "rgba(255, 107, 107, 0.15)", color: "#ff8787" };
  }
  if (p.includes("med") || p.includes("warm")) {
    return { bg: "rgba(255, 215, 0, 0.15)", color: "#ffd700" };
  }
  if (p.includes("low") || p.includes("cold")) {
    return { bg: "rgba(77, 171, 247, 0.15)", color: "#a5d8ff" };
  }
  return { bg: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" };
};

export const MatrixPage: React.FC = () => {
  const {
    apiKey,
    userEmail,
    jiraDomain,
    searchQuery,
    searchLoading,
    setSearchLoading,
  } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [fields, setFields] =
    useState<{ id: string; name: string }[]>(STANDARD_FIELDS);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [localFilter, setLocalFilter] = useState("");

  // Drag and drop states
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [updatingIssues, setUpdatingIssues] = useState<Record<string, boolean>>({});

  const matrixFieldParam = searchParams.get("matrix_field");

  // Determine active matrix field from URL param or localStorage or default to status
  const matrixField = useMemo(() => {
    if (matrixFieldParam) {
      return matrixFieldParam;
    }
    return localStorage.getItem("jozzos_matrix_field") || "status";
  }, [matrixFieldParam]);

  // Fetch available fields
  useEffect(() => {
    const fetchFields = async () => {
      if (!apiKey || !jiraDomain) return;
      setFieldsLoading(true);
      try {
        const clientConfig = {
          apiToken: apiKey,
          userEmail: userEmail,
          jiraDomain: jiraDomain,
          useProxy: true,
        };
        const fetched = await getJiraFields(clientConfig);
        const customOrNav = fetched.filter(
          (f) =>
            f.navigable &&
            ![
              "key",
              "summary",
              "status",
              "assignee",
              "reporter",
              "created",
              "updated",
            ].includes(f.id),
        );
        const sortedFetched = [...customOrNav].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );

        const combined = [...STANDARD_FIELDS];
        sortedFetched.forEach((f) => {
          if (!combined.some((c) => c.id === f.id)) {
            combined.push({ id: f.id, name: f.name });
          }
        });
        setFields(combined);
      } catch (err: unknown) {
        console.error("Failed to fetch Jira fields:", err);
      } finally {
        setFieldsLoading(false);
      }
    };

    fetchFields();
  }, [apiKey, jiraDomain, userEmail]);

  // Fetch issues function
  const fetchIssues = async (query: string) => {
    if (!query) {
      setIssues([]);
      return;
    }
    if (!jiraDomain) {
      setError("Jira Domain is required. Set it in the Settings page.");
      return;
    }
    setLoading(true);
    setSearchLoading(true);
    setError(null);

    try {
      const extraFields = [];
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
      if (!defaultFields.includes(matrixField)) {
        extraFields.push(matrixField);
      }

      const results = await getIssuesByFilter(
        {
          apiToken: apiKey,
          userEmail: userEmail,
          jiraDomain: jiraDomain,
          useProxy: true,
        },
        query,
        extraFields,
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
      setSearchLoading(false);
    }
  };

  // Trigger search when searchQuery or matrixField changes
  useEffect(() => {
    if (searchQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchIssues(searchQuery);
    } else {
      setIssues([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, matrixField]);

  // Handle grouping field change
  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextField = e.target.value;
    localStorage.setItem("jozzos_matrix_field", nextField);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("matrix_field", nextField);
      return next;
    });
  };

  // Filter issues locally
  const filteredIssues = useMemo(() => {
    if (!localFilter.trim()) return issues;
    const cleanFilter = localFilter.toLowerCase().trim();
    return issues.filter(
      (issue) =>
        issue.key.toLowerCase().includes(cleanFilter) ||
        issue.summary.toLowerCase().includes(cleanFilter) ||
        (issue.assignee &&
          issue.assignee.toLowerCase().includes(cleanFilter)) ||
        issue.status.toLowerCase().includes(cleanFilter),
    );
  }, [issues, localFilter]);

  // Grouped issues and column keys
  const { grouped, columns } = useMemo(() => {
    const grouped = groupIssuesByField(filteredIssues, matrixField);
    const columns = sortFieldValues(Object.keys(grouped));
    return { grouped, columns };
  }, [filteredIssues, matrixField]);

  const activeFieldName = useMemo(() => {
    return fields.find((f) => f.id === matrixField)?.name || matrixField;
  }, [fields, matrixField]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    setDraggedIssueId(issueId);
    e.dataTransfer.setData("text/plain", issueId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedIssueId(null);
    setDraggedOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colValue: string) => {
    e.preventDefault();
    if (draggedOverColumn !== colValue) {
      setDraggedOverColumn(colValue);
    }
  };

  const handleDrop = async (e: React.DragEvent, colValue: string) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData("text/plain") || draggedIssueId;
    setDraggedOverColumn(null);
    setDraggedIssueId(null);

    if (!issueId) return;

    const issueIndex = issues.findIndex((i) => i.id === issueId);
    if (issueIndex === -1) return;

    const issue = issues[issueIndex];
    const currentVal = getIssueFieldValue(issue, matrixField);
    if (currentVal === colValue) {
      return;
    }

    const originalIssues = [...issues];

    // Optimistically update frontend state
    const updatedIssues = issues.map((i) => {
      if (i.id === issueId) {
        const nextIssue = { ...i };
        if (matrixField === "status") {
          nextIssue.status = colValue;
        } else if (matrixField === "assignee") {
          nextIssue.assignee = colValue === "-" ? undefined : colValue;
        } else if (matrixField === "reporter") {
          nextIssue.reporter = colValue === "-" ? undefined : colValue;
        } else if (matrixField === "priority") {
          nextIssue.priority = colValue === "-" ? undefined : colValue;
        } else {
          const nextCustomFields = { ...nextIssue.customFields };
          const originalCustomValue = nextCustomFields[matrixField];

          if (originalCustomValue && typeof originalCustomValue === "object") {
            const obj = originalCustomValue as Record<string, unknown>;
            if (obj.value !== undefined) {
              nextCustomFields[matrixField] = colValue === "-" ? null : { ...obj, value: colValue };
            } else if (obj.name !== undefined) {
              nextCustomFields[matrixField] = colValue === "-" ? null : { ...obj, name: colValue };
            } else if (obj.displayName !== undefined) {
              nextCustomFields[matrixField] = colValue === "-" ? null : { ...obj, displayName: colValue };
            } else {
              nextCustomFields[matrixField] = colValue === "-" ? null : colValue;
            }
          } else {
            nextCustomFields[matrixField] = colValue === "-" ? null : colValue;
          }
          nextIssue.customFields = nextCustomFields;
        }
        return nextIssue;
      }
      return i;
    });

    setIssues(updatedIssues);
    setUpdatingIssues((prev) => ({ ...prev, [issueId]: true }));
    setError(null);

    try {
      const clientConfig = {
        apiToken: apiKey,
        userEmail: userEmail,
        jiraDomain: jiraDomain,
        useProxy: true,
      };

      if (matrixField === "status") {
        const transitions = await getAvailableTransitions(clientConfig, issue.key);
        const match = transitions.find(
          (t) => t.name.toLowerCase() === colValue.toLowerCase()
        );
        if (!match) {
          throw new Error(
            `Cannot transition issue ${issue.key} to "${colValue}". Valid transitions: ${transitions.map((t) => t.name).join(", ")}`
          );
        }
        await transitionIssue(clientConfig, issue.key, match.id);
      } else if (matrixField === "assignee") {
        if (colValue === "-" || colValue.toLowerCase() === "unassigned") {
          await assignIssue(clientConfig, issue.key, null);
        } else {
          const users = await searchJiraUsers(clientConfig, colValue);
          const user = users.find((u) => u.displayName.toLowerCase() === colValue.toLowerCase()) || users[0];
          if (!user) {
            throw new Error(`No Jira user found matching "${colValue}"`);
          }
          await assignIssue(clientConfig, issue.key, user.accountId);
        }
      } else if (matrixField === "reporter") {
        if (colValue === "-" || colValue.toLowerCase() === "unassigned") {
          await updateIssueFields(clientConfig, issue.key, { reporter: null });
        } else {
          const users = await searchJiraUsers(clientConfig, colValue);
          const user = users.find((u) => u.displayName.toLowerCase() === colValue.toLowerCase()) || users[0];
          if (!user) {
            throw new Error(`No Jira user found matching "${colValue}"`);
          }
          await updateIssueFields(clientConfig, issue.key, {
            reporter: { id: user.accountId },
          });
        }
      } else if (matrixField === "priority") {
        if (colValue === "-") {
          await updateIssueFields(clientConfig, issue.key, { priority: null });
        } else {
          await updateIssueFields(clientConfig, issue.key, {
            priority: { name: colValue },
          });
        }
      } else {
        const originalCustomValue = issue.customFields?.[matrixField];
        let payloadValue: unknown = colValue === "-" ? null : colValue;

        if (colValue !== "-") {
          if (originalCustomValue !== undefined && originalCustomValue !== null) {
            if (Array.isArray(originalCustomValue)) {
              const vals = colValue.split(",").map((v) => v.trim()).filter(Boolean);
              const isValObj = originalCustomValue.length > 0 && typeof originalCustomValue[0] === "object";
              if (isValObj) {
                const firstObj = originalCustomValue[0] as Record<string, unknown>;
                if (firstObj.value !== undefined) {
                  payloadValue = vals.map((v) => ({ value: v }));
                } else if (firstObj.name !== undefined) {
                  payloadValue = vals.map((v) => ({ name: v }));
                }
              } else {
                payloadValue = vals;
              }
            } else if (typeof originalCustomValue === "object") {
              const obj = originalCustomValue as Record<string, unknown>;
              if (obj.value !== undefined) {
                payloadValue = { value: colValue };
              } else if (obj.name !== undefined) {
                payloadValue = { name: colValue };
              } else if (obj.displayName !== undefined) {
                payloadValue = { id: obj.id || obj.accountId };
              }
            } else if (typeof originalCustomValue === "boolean") {
              payloadValue = colValue.toLowerCase() === "yes" || colValue.toLowerCase() === "true";
            } else if (typeof originalCustomValue === "number") {
              payloadValue = Number(colValue);
            }
          }
        }

        await updateIssueFields(clientConfig, issue.key, {
          [matrixField]: payloadValue,
        });
      }
    } catch (err: unknown) {
      setIssues(originalIssues);
      if (err instanceof Error) {
        setError(`Failed to update ${matrixField}: ${err.message}`);
      } else {
        setError(`An error occurred while updating ${matrixField}.`);
      }
    } finally {
      setUpdatingIssues((prev) => {
        const next = { ...prev };
        delete next[issueId];
        return next;
      });
    }
  };

  const handleRefresh = () => {
    fetchIssues(searchQuery);
  };

  useEffect(() => {
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

  const escapeHtml = (unsafe: string): string => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const copyIssueWithBlockers = (issue: Issue) => {
    const collectIssues = (currentIssue: Issue): Issue[] => {
      const issuesList: Issue[] = [currentIssue];
      if (currentIssue.blockedBy) {
        currentIssue.blockedBy.forEach((blocker) => {
          issuesList.push(blocker);
          if (blocker.blockedBy) {
            blocker.blockedBy.forEach((nestedBlocker) => {
              issuesList.push(nestedBlocker);
            });
          }
        });
      }
      if (currentIssue.blockingIssues) {
        currentIssue.blockingIssues.forEach((blockingIssue) => {
          issuesList.push(blockingIssue);
        });
      }
      return issuesList;
    };

    const allIssues = collectIssues(issue);
    if (allIssues.length === 0) {
      setError("No issues to copy");
      return;
    }

    let htmlContent = `<!DOCTYPE html><table style="border-collapse: collapse; width: 100%;"><thead><tr><th style="border: 1px solid #666; padding: 8px; background: #333; color: #fff;">Key</th><th style="border: 1px solid #666; padding: 8px; background: #333; color: #fff;">Summary</th><th style="border: 1px solid #666; padding: 8px; background: #333; color: #fff;">Assignee</th></tr></thead><tbody>`;
    allIssues.forEach((item) => {
      const key = item.key || "";
      const summary = item.summary || "";
      const assignee = item.assignee || "-";
      htmlContent += `<tr><td style="border: 1px solid #666; padding: 8px;"><a href="${item.url}" style="color: #66bb6a; text-decoration: none;">${escapeHtml(key)}</a></td><td style="border: 1px solid #666; padding: 8px;">${escapeHtml(summary)}</td><td style="border: 1px solid #666; padding: 8px;">${escapeHtml(assignee)}</td></tr>`;
    });
    htmlContent += "</tbody></table>";

    const blob = new Blob([htmlContent], { type: "text/html" });
    const data = [new ClipboardItem({ "text/html": blob })];

    navigator.clipboard
      .write(data)
      .then(() => {
        setError(null);
        setSuccess(`Copied ${allIssues.length} issue(s) to clipboard!`);
        setTimeout(() => {
          setSuccess(null);
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy issue:", err);
        setError("Failed to copy issue to clipboard");
      });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Top dashboard control panel */}
      <div
        className="card-panel animate-fade-in"
        style={{
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              background:
                "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              borderRadius: "8px",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--bg-primary)",
            }}
          >
            <LayoutGrid size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Matrix View</h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                margin: "2px 0 0 0",
              }}
            >
              Grouping {filteredIssues.length} issues into {columns.length}{" "}
              columns by {activeFieldName}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {/* Group selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                fontWeight: "500",
              }}
            >
              Group by:
            </span>
            <select
              value={matrixField}
              onChange={handleFieldChange}
              className="input-field"
              style={{
                width: "180px",
                height: "36px",
                padding: "0.25rem 0.75rem",
                fontSize: "0.85rem",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              disabled={fieldsLoading}
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.id.startsWith("customfield_") ? "(Custom)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Quick local search/filter */}
          <div style={{ position: "relative", width: "220px" }}>
            <input
              type="text"
              placeholder="Filter board..."
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
              className="input-field"
              style={{
                height: "36px",
                padding: "0.25rem 0.75rem 0.25rem 2rem",
                fontSize: "0.85rem",
                borderRadius: "6px",
              }}
            />
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-secondary)",
              }}
            />
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="card-panel"
            style={{
              padding: "0 0.75rem",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "var(--btn-secondary-bg)",
              border: "1px solid var(--btn-secondary-border)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              transition: "all var(--transition-fast)",
              margin: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--btn-secondary-hover-bg)";
              e.currentTarget.style.borderColor = "var(--accent-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--btn-secondary-bg)";
              e.currentTarget.style.borderColor = "var(--btn-secondary-border)";
            }}
            disabled={loading}
            title="Refresh issues"
          >
            <RefreshCw
              size={16}
              className={loading || searchLoading ? "spin" : ""}
              style={{ transition: "transform 1s ease" }}
            />
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            background: "var(--alert-error-bg)",
            color: "var(--alert-error-color)",
            border: "1px solid var(--alert-error-border)",
            borderRadius: "12px",
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <AlertTriangle size={20} />
          <div style={{ flex: 1, fontSize: "0.9rem" }}>{error}</div>
        </div>
      )}

      {/* Success alert */}
      {success && (
        <div
          style={{
            background: "rgba(102, 252, 241, 0.1)",
            color: "var(--accent-secondary)",
            border: "1px solid rgba(102, 252, 241, 0.25)",
            borderRadius: "12px",
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div style={{ flex: 1, fontSize: "0.9rem" }}>{success}</div>
        </div>
      )}

      {/* Main Board scrolling container */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          overflowX: "auto",
          padding: "0.5rem 0 1.5rem 0",
          flex: 1,
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        {/* Loading Spinner */}
        {(loading || searchLoading) && issues.length === 0 && (
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              height: "200px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                border: "3px solid var(--border-color)",
                borderTop: "3px solid var(--accent-secondary)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
        )}

        {/* Empty State */}
        {!loading && !searchLoading && issues.length === 0 && (
          <div
            style={{
              flex: 1,
              padding: "4rem 2rem",
              textAlign: "center",
              background: "var(--bg-secondary)",
              border: "1px dashed var(--border-color)",
              borderRadius: "16px",
              color: "var(--text-secondary)",
            }}
          >
            <Filter
              size={48}
              style={{
                color: "var(--accent-primary)",
                opacity: 0.5,
                marginBottom: "1rem",
              }}
            />
            <h3
              style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}
            >
              No issues loaded
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              Enter a Filter ID or JQL query in the header search input to begin
              grouping issues.
            </p>
          </div>
        )}

        {/* Kanban Columns */}
        {issues.length > 0 &&
          columns.map((colValue) => {
            const colIssues = grouped[colValue] || [];
            const isOver = draggedOverColumn === colValue;
            return (
              <div
                key={colValue}
                onDragOver={(e) => handleDragOver(e, colValue)}
                onDrop={(e) => handleDrop(e, colValue)}
                style={{
                  flex: "0 0 320px",
                  background: isOver ? "rgba(69, 162, 158, 0.08)" : "var(--bg-secondary)",
                  border: isOver ? "1px dashed var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: "calc(100vh - 260px)",
                  boxShadow: isOver ? "0 4px 20px rgba(69, 162, 158, 0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
                  overflow: "hidden",
                  transition: "all var(--transition-fast)",
                  transform: isOver ? "scale(1.01)" : "scale(1)",
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    padding: "1rem",
                    borderBottom: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderTop: `4px solid ${
                      colValue === "-"
                        ? "#4a4f58"
                        : `hsl(${Math.abs(
                            colValue
                              .split("")
                              .reduce(
                                (acc, char) => acc + char.charCodeAt(0),
                                0,
                              ) % 360,
                          )}, 60%, 55%)`
                    }`,
                  }}
                >
                  <span
                    style={{
                      fontWeight: "600",
                      fontSize: "0.9rem",
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginRight: "0.5rem",
                    }}
                    title={colValue === "-" ? "Unassigned / Not Set" : colValue}
                  >
                    {colValue === "-" ? "Unassigned / Not Set" : colValue}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: "var(--btn-secondary-bg)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    {colIssues.length}
                  </span>
                </div>

                {/* Column Issues Cards List */}
                <div
                  style={{
                    padding: "1rem",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    flex: 1,
                  }}
                >
                  {colIssues.length === 0 ? (
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        textAlign: "center",
                        padding: "1rem",
                      }}
                    >
                      No issues
                    </div>
                  ) : (
                    colIssues.map((issue) => {
                      const priorityColor = getPriorityColor(issue.priority);
                      const isDragging = draggedIssueId === issue.id;
                      const isUpdating = !!updatingIssues[issue.id];
                      return (
                        <div
                          key={issue.id}
                          draggable={!isUpdating}
                          onDragStart={(e) => handleDragStart(e, issue.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            if (isUpdating || isDragging) return;
                            setSelectedIssue(issue);
                          }}
                          style={{
                            background: "var(--bg-primary)",
                            border: isDragging
                              ? "1px dashed var(--accent-secondary)"
                              : isUpdating
                                ? "1px solid var(--accent-primary)"
                                : "1px solid var(--border-color)",
                            borderRadius: "10px",
                            padding: "0.85rem",
                            cursor: isUpdating ? "not-allowed" : "grab",
                            transition: "all var(--transition-fast)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            opacity: isDragging ? 0.4 : isUpdating ? 0.7 : isStatusClosed(issue.status) ? 0.55 : 1,
                            position: "relative",
                          }}
                          onMouseEnter={(e) => {
                            if (isUpdating || isDragging) return;
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                            e.currentTarget.style.borderColor =
                              "var(--accent-primary)";
                            e.currentTarget.style.boxShadow =
                              "0 4px 12px rgba(69, 162, 158, 0.12)";
                          }}
                          onMouseLeave={(e) => {
                            if (isUpdating || isDragging) return;
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.borderColor =
                              "var(--border-color)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {/* Card Top Row */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {isUpdating && (
                                <RefreshCw
                                  size={12}
                                  className="spin"
                                  style={{ color: "var(--accent-primary)" }}
                                />
                              )}
                              <a
                                href={issue.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "var(--accent-secondary)",
                                  textDecoration: "none",
                                  fontWeight: "600",
                                  fontSize: "0.8rem",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {issue.key}
                              </a>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.35rem",
                                alignItems: "center",
                              }}
                            >
                              {/* Status badge (only show if not grouping by status) */}
                              {matrixField !== "status" && (
                                <span
                                  style={{
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    fontWeight: "500",
                                    background: isStatusClosed(issue.status)
                                      ? "var(--status-closed-bg)"
                                      : "var(--status-active-bg)",
                                    color: isStatusClosed(issue.status)
                                      ? "var(--status-closed-color)"
                                      : "var(--status-active-color)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {issue.status}
                                </span>
                              )}
                              {/* Priority */}
                              {issue.priority && (
                                <span
                                  style={{
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    fontWeight: "600",
                                    background: priorityColor.bg,
                                    color: priorityColor.color,
                                    whiteSpace: "nowrap",
                                  }}
                                  title={`Priority: ${issue.priority}`}
                                >
                                  {issue.priority}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Middle Summary */}
                          <h4
                            style={{
                              margin: 0,
                              fontSize: "0.85rem",
                              fontWeight: "500",
                              color: "var(--text-primary)",
                              lineHeight: "1.35",
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {issue.summary}
                          </h4>

                          {/* Card Bottom Row */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: "0.25rem",
                              fontSize: "0.75rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <span>{issue.assignee || "Unassigned"}</span>
                            {/* Blockers Badge */}
                            {issue.blockedBy && issue.blockedBy.length > 0 && (
                              <span
                                style={{
                                  color: "var(--color-error)",
                                  fontWeight: "500",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "2px",
                                }}
                                title={`${issue.blockedBy.length} blocker issue(s)`}
                              >
                                <AlertTriangle size={12} />
                                {issue.blockedBy.length}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Dismissable Lightbox for Issue Details */}
      {selectedIssue && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
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
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "16px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              width: "95vw",
              maxWidth: "1350px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
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
                background: "var(--bg-primary)",
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
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      background: "rgba(102, 252, 241, 0.1)",
                      color: "var(--accent-secondary)",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      letterSpacing: "0.05em",
                      border: "1px solid rgba(102, 252, 241, 0.25)",
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
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
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
                <button
                  className="card-panel"
                  style={{
                    padding: "0.4rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    background: "var(--btn-secondary-bg)",
                    border: "1px solid var(--btn-secondary-border)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    transition: "all var(--transition-fast)",
                    fontSize: "0.85rem",
                    height: "36px",
                    boxSizing: "border-box",
                    margin: 0,
                    alignSelf: "flex-start",
                  }}
                  onClick={() => copyIssueWithBlockers(selectedIssue)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--btn-secondary-hover-bg)";
                    e.currentTarget.style.borderColor = "var(--accent-secondary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--btn-secondary-bg)";
                    e.currentTarget.style.borderColor = "var(--btn-secondary-border)";
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4"></path>
                    <polyline points="16 4 12 4 12 12 16 12"></polyline>
                    <line x1="12" y1="12" x2="12" y2="20"></line>
                    <line x1="12" y1="20" x2="16" y2="20"></line>
                    <line x1="8" y1="20" x2="8" y2="12"></line>
                    <line x1="8" y1="12" x2="12" y2="12"></line>
                  </svg>
                  Copy issue with blockers
                </button>
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
                  e.currentTarget.style.background = "var(--btn-secondary-hover-bg)";
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
                {/* Blocked Alert Banner */}
                {selectedIssue.blockedBy &&
                  selectedIssue.blockedBy.filter((b) => !isStatusClosed(b.status)).length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        background: "rgba(255, 107, 107, 0.1)",
                        border: "1px solid rgba(255, 107, 107, 0.25)",
                        borderRadius: "8px",
                        padding: "0.75rem 1rem",
                        color: "var(--status-active-color)",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <div style={{ fontSize: "0.85rem", lineHeight: "1.4" }}>
                        <strong>Blocked:</strong> This issue is blocked by{" "}
                        {selectedIssue.blockedBy
                          .filter((b) => !isStatusClosed(b.status))
                          .map((blocker, idx) => (
                            <React.Fragment key={blocker.id}>
                              {idx > 0 && ", "}
                              <a
                                href={blocker.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "var(--color-error)",
                                  fontWeight: "600",
                                  textDecoration: "none",
                                  borderBottom: "1px dashed rgba(255, 107, 107, 0.4)",
                                }}
                              >
                                {blocker.key}
                              </a>
                            </React.Fragment>
                          ))}
                      </div>
                    </div>
                  )}

                {/* Dependencies Section */}
                {((selectedIssue.blockedBy && selectedIssue.blockedBy.length > 0) ||
                  (selectedIssue.blocks && selectedIssue.blocks.length > 0)) && (
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
                        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                        gap: "1.5rem",
                      }}
                    >
                      {/* Blocked By Column */}
                      <div>
                        <h4
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            color: "var(--color-error)",
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
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          Blocked By ({selectedIssue.blockedBy?.filter((b) => !isStatusClosed(b.status)).length || 0})
                        </h4>

                        {selectedIssue.blockedBy &&
                        selectedIssue.blockedBy.filter((b) => !isStatusClosed(b.status)).length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                          >
                            {selectedIssue.blockedBy
                              .filter((b) => !isStatusClosed(b.status))
                              .map((dep) => (
                                <div
                                  key={dep.id}
                                  style={{
                                    background: "var(--dependency-active-bg)",
                                    border: "1px solid var(--dependency-active-border)",
                                    borderRadius: "8px",
                                    padding: "0.75rem",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "1rem",
                                    transition: "background 0.2s, border-color 0.2s",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "var(--dependency-active-hover-bg)";
                                    e.currentTarget.style.borderColor = "var(--dependency-active-hover-border)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "var(--dependency-active-bg)";
                                    e.currentTarget.style.borderColor = "var(--dependency-active-border)";
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
                                        color: "var(--color-error)",
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
                                      color: "var(--status-active-color)",
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
                            color: "var(--color-info)",
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
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                          </svg>
                          Blocks ({selectedIssue.blocks?.length || 0})
                        </h4>

                        {selectedIssue.blocks && selectedIssue.blocks.length > 0 ? (
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
                                  background: "var(--dependency-blocks-bg)",
                                  border: "1px solid var(--dependency-blocks-border)",
                                  borderRadius: "8px",
                                  padding: "0.75rem",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "1rem",
                                  transition: "background 0.2s, border-color 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "var(--dependency-blocks-hover-bg)";
                                  e.currentTarget.style.borderColor = "var(--dependency-blocks-hover-border)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "var(--dependency-blocks-bg)";
                                  e.currentTarget.style.borderColor = "var(--dependency-blocks-border)";
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
                                      color: "var(--accent-secondary)",
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
                                    background: "rgba(102, 252, 241, 0.15)",
                                    color: "var(--accent-secondary)",
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
                            Does not block any issues.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
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
                    }}
                  >
                    {selectedIssue.description ? (
                      renderADFContent(selectedIssue.description)
                    ) : (
                      <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                        No description provided.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar (Right Side) */}
              <div
                style={{
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
                      {selectedIssue.assignee ? selectedIssue.assignee.charAt(0) : "?"}
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
                      {selectedIssue.reporter ? selectedIssue.reporter.charAt(0) : "?"}
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

      <style>{`
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
    </div>
  );
};

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
