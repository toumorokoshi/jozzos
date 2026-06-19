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
    </div>
  );
};
