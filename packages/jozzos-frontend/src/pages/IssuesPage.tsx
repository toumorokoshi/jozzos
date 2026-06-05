import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getIssuesByFilter,
  updateIssueFields,
  getAvailableTransitions,
  transitionIssue,
  assignIssue,
  searchJiraUsers,
  getJiraFields,
  type JiraField,
  addBlocker,
  type Issue,
  sortIssues,
  matchIssue,
} from "jozzos-backend";

import { useConfig } from "../context/ConfigContext";

const MAX_HISTORY_LENGTH = 1000;

interface ColumnConfig {
  id: string;
  name: string;
  isCustom?: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "key", name: "Key" },
  { id: "summary", name: "Summary" },
  { id: "status", name: "Status" },
  { id: "assignee", name: "Assignee" },
  { id: "reporter", name: "Reporter" },
];

const resolveColumn = (
  id: string,
  allCols: ColumnConfig[],
  jiraFields: JiraField[],
): ColumnConfig => {
  const standard = [
    { id: "key", name: "Key" },
    { id: "summary", name: "Summary" },
    { id: "status", name: "Status" },
    { id: "assignee", name: "Assignee" },
    { id: "reporter", name: "Reporter" },
    { id: "created", name: "Created" },
    { id: "updated", name: "Updated" },
  ].find((c) => c.id === id);
  if (standard) return standard;

  const saved = allCols.find((c) => c.id === id);
  if (saved) return saved;

  const jiraField = jiraFields.find((f) => f.id === id);
  if (jiraField) {
    return {
      id: jiraField.id,
      name: jiraField.name,
      isCustom: true,
    };
  }

  return {
    id,
    name: id,
    isCustom: true,
  };
};

const formatFieldValue = (val: unknown): string => {
  if (val === null || val === undefined) return "-";
  if (typeof val === "string") return val;
  if (typeof val === "number") return val.toString();
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) {
    return val.map((v) => formatFieldValue(v)).join(", ");
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (obj.value !== undefined) return formatFieldValue(obj.value);
    if (obj.name !== undefined) return formatFieldValue(obj.name);
    if (obj.displayName !== undefined) return formatFieldValue(obj.displayName);
    if (obj.content && Array.isArray(obj.content)) {
      return "[Rich Text]";
    }
    return JSON.stringify(val);
  }
  return String(val);
};

export const IssuesPage: React.FC = () => {
  const { apiKey, userEmail, jiraDomain } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const [filterId, setFilterId] = useState(queryParam);
  const [prevQueryParam, setPrevQueryParam] = useState(queryParam);
  const colsParam = searchParams.get("cols") || "";
  const [prevColsParam, setPrevColsParam] = useState(colsParam);

  if (queryParam !== prevQueryParam) {
    setPrevQueryParam(queryParam);
    setFilterId(queryParam);
  }
  const [issues, setIssues] = useState<Issue[]>([]);
  const sortByParam = searchParams.get("sortBy") || "";
  const sortDirParam = searchParams.get("sortDir") || "";

  const initialSortConfig = sortByParam
    ? {
        key: sortByParam,
        direction: (sortDirParam === "desc" ? "desc" : "asc") as "asc" | "desc",
      }
    : null;

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(initialSortConfig);

  const [prevSortByParam, setPrevSortByParam] = useState(sortByParam);
  const [prevSortDirParam, setPrevSortDirParam] = useState(sortDirParam);

  if (sortByParam !== prevSortByParam || sortDirParam !== prevSortDirParam) {
    setPrevSortByParam(sortByParam);
    setPrevSortDirParam(sortDirParam);
    setSortConfig(
      sortByParam
        ? {
            key: sortByParam,
            direction: (sortDirParam === "desc" ? "desc" : "asc") as
              | "asc"
              | "desc",
          }
        : null,
    );
  }

  const [rowFilterQuery, setRowFilterQuery] = useState("");

  const filteredIssues = React.useMemo(() => {
    if (!rowFilterQuery.trim()) return issues;
    return issues.filter((issue) => matchIssue(issue, rowFilterQuery));
  }, [issues, rowFilterQuery]);

  const sortedIssues = React.useMemo(() => {
    if (!sortConfig) return filteredIssues;
    return sortIssues(filteredIssues, sortConfig.key, sortConfig.direction);
  }, [filteredIssues, sortConfig]);

  const handleSort = (colId: string) => {
    let nextSortBy = "";
    let nextSortDir = "";

    if (!sortConfig || sortConfig.key !== colId) {
      nextSortBy = colId;
      nextSortDir = "asc";
    } else if (sortConfig.direction === "asc") {
      nextSortBy = colId;
      nextSortDir = "desc";
    }

    const nextParams = new URLSearchParams(searchParams);
    if (nextSortBy) {
      nextParams.set("sortBy", nextSortBy);
      nextParams.set("sortDir", nextSortDir);
    } else {
      nextParams.delete("sortBy");
      nextParams.delete("sortDir");
    }
    setSearchParams(nextParams);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [addingBlockerFor, setAddingBlockerFor] = useState<Issue | null>(null);
  const [blockerKeyInput, setBlockerKeyInput] = useState("");
  const [addingBlockerLoading, setAddingBlockerLoading] = useState(false);
  const [addingBlockerError, setAddingBlockerError] = useState<string | null>(
    null,
  );

  const [activeColumns, setActiveColumns] = useState<ColumnConfig[]>(() => {
    if (colsParam) {
      const ids = colsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const savedAll = localStorage.getItem("jozzos_all_columns");
      let allCols: ColumnConfig[] = [];
      if (savedAll) {
        try {
          allCols = JSON.parse(savedAll);
        } catch (e) {
          console.warn("Failed to parse all columns", e);
        }
      }
      return ids.map((id) => resolveColumn(id, allCols, []));
    }
    const saved = localStorage.getItem("jozzos_active_columns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse active columns", e);
      }
    }
    return DEFAULT_COLUMNS;
  });

  const saveActiveColumns = (cols: ColumnConfig[]) => {
    setActiveColumns(cols);
    localStorage.setItem("jozzos_active_columns", JSON.stringify(cols));

    const nextParams = new URLSearchParams(searchParams);
    const colIds = cols.map((c) => c.id).join(",");
    if (colIds) {
      nextParams.set("cols", colIds);
    } else {
      nextParams.delete("cols");
    }
    setPrevColsParam(colIds);
    setSearchParams(nextParams);
  };

  const [allColumns, setAllColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem("jozzos_all_columns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse all columns", e);
      }
    }
    return [
      { id: "key", name: "Key" },
      { id: "summary", name: "Summary" },
      { id: "status", name: "Status" },
      { id: "assignee", name: "Assignee" },
      { id: "reporter", name: "Reporter" },
      { id: "created", name: "Created" },
      { id: "updated", name: "Updated" },
    ];
  });

  const saveAllColumns = (cols: ColumnConfig[]) => {
    setAllColumns(cols);
    localStorage.setItem("jozzos_all_columns", JSON.stringify(cols));
  };

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [availableCustomFields, setAvailableCustomFields] = useState<
    JiraField[]
  >([]);

  const [selectedJiraFieldId, setSelectedJiraFieldId] = useState("");
  const [manualFieldId, setManualFieldId] = useState("");
  const [manualFieldName, setManualFieldName] = useState("");

  if (colsParam !== prevColsParam) {
    setPrevColsParam(colsParam);
    if (colsParam) {
      const ids = colsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      setActiveColumns(
        ids.map((id) => resolveColumn(id, allColumns, availableCustomFields)),
      );
    } else {
      const saved = localStorage.getItem("jozzos_active_columns");
      if (saved) {
        try {
          setActiveColumns(JSON.parse(saved));
        } catch {
          setActiveColumns(DEFAULT_COLUMNS);
        }
      } else {
        setActiveColumns(DEFAULT_COLUMNS);
      }
    }
  }

  React.useEffect(() => {
    const fetchFields = async () => {
      if (!apiKey || !jiraDomain) return;
      try {
        const clientConfig = {
          apiToken: apiKey,
          userEmail: userEmail,
          jiraDomain: jiraDomain,
          useProxy: true,
        };
        const fields = await getJiraFields(clientConfig);
        const customOrNav = fields.filter(
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
        const sortedFields = [...customOrNav].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
        setAvailableCustomFields(sortedFields);

        // Resolve names in activeColumns and allColumns using the fetched fields
        setActiveColumns((currentActive) => {
          let changed = false;
          const nextActive = currentActive.map((col) => {
            if (col.name === col.id) {
              const found = sortedFields.find((f) => f.id === col.id);
              if (found) {
                changed = true;
                return {
                  ...col,
                  name: found.name,
                  isCustom: found.custom || col.isCustom,
                };
              }
            }
            return col;
          });
          return changed ? nextActive : currentActive;
        });

        setAllColumns((currentAll) => {
          let changed = false;
          const nextAll = currentAll.map((col) => {
            if (col.name === col.id) {
              const found = sortedFields.find((f) => f.id === col.id);
              if (found) {
                changed = true;
                return {
                  ...col,
                  name: found.name,
                  isCustom: found.custom || col.isCustom,
                };
              }
            }
            return col;
          });
          if (changed) {
            localStorage.setItem("jozzos_all_columns", JSON.stringify(nextAll));
            return nextAll;
          }
          return currentAll;
        });
      } catch (e) {
        console.error("Failed to fetch Jira fields", e);
      }
    };
    fetchFields();
  }, [apiKey, userEmail, jiraDomain]);

  const moveColumn = (index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= activeColumns.length) return;
    const nextCols = [...activeColumns];
    const temp = nextCols[index];
    nextCols[index] = nextCols[nextIndex];
    nextCols[nextIndex] = temp;
    saveActiveColumns(nextCols);
  };

  const toggleColumnActive = (colId: string) => {
    const isActive = activeColumns.some((col) => col.id === colId);
    if (isActive) {
      if (colId === "key" || colId === "summary") return;
      const nextCols = activeColumns.filter((col) => col.id !== colId);
      saveActiveColumns(nextCols);
    } else {
      const colToActivate =
        allColumns.find((col) => col.id === colId) ||
        availableCustomFields.find((f) => f.id === colId);

      if (colToActivate) {
        const newCol: ColumnConfig = {
          id: colToActivate.id,
          name: colToActivate.name,
          isCustom:
            "custom" in colToActivate
              ? colToActivate.custom
              : (colToActivate as ColumnConfig).isCustom,
        };
        const nextCols = [...activeColumns, newCol];
        saveActiveColumns(nextCols);

        if (!allColumns.some((c) => c.id === colId)) {
          saveAllColumns([...allColumns, newCol]);
        }
      }
    }
  };

  const handleAddSelectedJiraField = () => {
    if (!selectedJiraFieldId) return;
    const field = availableCustomFields.find(
      (f) => f.id === selectedJiraFieldId,
    );
    if (!field) return;

    if (activeColumns.some((col) => col.id === field.id)) {
      setSelectedJiraFieldId("");
      return;
    }

    const newCol: ColumnConfig = {
      id: field.id,
      name: field.name,
      isCustom: true,
    };

    const nextActive = [...activeColumns, newCol];
    saveActiveColumns(nextActive);

    if (!allColumns.some((col) => col.id === field.id)) {
      saveAllColumns([...allColumns, newCol]);
    }

    setSelectedJiraFieldId("");
  };

  const handleAddManualCustomField = () => {
    const trimmedId = manualFieldId.trim();
    const trimmedName = manualFieldName.trim();
    if (!trimmedId || !trimmedName) return;

    if (activeColumns.some((col) => col.id === trimmedId)) {
      setManualFieldId("");
      setManualFieldName("");
      return;
    }

    const newCol: ColumnConfig = {
      id: trimmedId,
      name: trimmedName,
      isCustom: true,
    };

    const nextActive = [...activeColumns, newCol];
    saveActiveColumns(nextActive);

    if (!allColumns.some((col) => col.id === trimmedId)) {
      saveAllColumns([...allColumns, newCol]);
    }

    setManualFieldId("");
    setManualFieldName("");
  };

  const resetColumnsToDefault = () => {
    saveActiveColumns(DEFAULT_COLUMNS);
  };

  // States for inline double-click editing
  const [editingCell, setEditingCell] = useState<{
    issueId: string;
    field: "summary" | "status" | "assignee" | "reporter";
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingCell, setSavingCell] = useState(false);
  const [transitionsMap, setTransitionsMap] = useState<
    Record<string, { id: string; name: string }[]>
  >({});
  const [loadingTransitionsIssueId, setLoadingTransitionsIssueId] = useState<
    string | null
  >(null);

  const startEditingStatus = async (issue: Issue) => {
    setEditingCell({ issueId: issue.id, field: "status" });
    setEditValue(issue.status);

    if (transitionsMap[issue.id]) {
      return;
    }

    setLoadingTransitionsIssueId(issue.id);
    try {
      const clientConfig = {
        apiToken: apiKey,
        userEmail: userEmail,
        jiraDomain: jiraDomain,
        useProxy: true,
      };
      const transitions = await getAvailableTransitions(
        clientConfig,
        issue.key,
      );
      setTransitionsMap((prev) => ({ ...prev, [issue.id]: transitions }));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to fetch status transitions");
      }
      setEditingCell(null);
    } finally {
      setLoadingTransitionsIssueId(null);
    }
  };

  const handleTransitionSave = async (
    issueId: string,
    transitionId: string,
    transitionName: string,
  ) => {
    setSavingCell(true);
    setError(null);
    try {
      let issue = issues.find((i) => i.id === issueId);
      if (!issue) {
        for (const i of issues) {
          const found = i.blockingIssues?.find((b) => b.id === issueId);
          if (found) {
            issue = found;
            break;
          }
        }
      }
      if (!issue) return;

      const clientConfig = {
        apiToken: apiKey,
        userEmail: userEmail,
        jiraDomain: jiraDomain,
        useProxy: true,
      };

      await transitionIssue(clientConfig, issue.key, transitionId);
      setIssues((prev) =>
        prev.map((i) => {
          const updated =
            i.id === issueId ? { ...i, status: transitionName } : i;
          if (updated.blockingIssues) {
            updated.blockingIssues = updated.blockingIssues.map((b) =>
              b.id === issueId ? { ...b, status: transitionName } : b,
            );
          }
          return updated;
        }),
      );
      setEditingCell(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to transition status");
      }
    } finally {
      setSavingCell(false);
    }
  };

  const handleInlineSave = async (
    issueId: string,
    field: "summary" | "status" | "assignee" | "reporter",
    value: string,
  ) => {
    setSavingCell(true);
    setError(null);
    try {
      let issue = issues.find((i) => i.id === issueId);
      if (!issue) {
        for (const i of issues) {
          const found = i.blockingIssues?.find((b) => b.id === issueId);
          if (found) {
            issue = found;
            break;
          }
        }
      }
      if (!issue) return;

      const clientConfig = {
        apiToken: apiKey,
        userEmail: userEmail,
        jiraDomain: jiraDomain,
        useProxy: true,
      };

      if (field === "summary") {
        await updateIssueFields(clientConfig, issue.key, { summary: value });
        setIssues((prev) =>
          prev.map((i) => {
            const updated = i.id === issueId ? { ...i, summary: value } : i;
            if (updated.blockingIssues) {
              updated.blockingIssues = updated.blockingIssues.map((b) =>
                b.id === issueId ? { ...b, summary: value } : b,
              );
            }
            return updated;
          }),
        );
      } else if (field === "assignee") {
        const trimmed = value.trim();
        if (
          !trimmed ||
          trimmed === "-" ||
          trimmed.toLowerCase() === "unassigned"
        ) {
          await assignIssue(clientConfig, issue.key, null);
          setIssues((prev) =>
            prev.map((i) => {
              const updated =
                i.id === issueId ? { ...i, assignee: undefined } : i;
              if (updated.blockingIssues) {
                updated.blockingIssues = updated.blockingIssues.map((b) =>
                  b.id === issueId ? { ...b, assignee: undefined } : b,
                );
              }
              return updated;
            }),
          );
        } else {
          const users = await searchJiraUsers(clientConfig, trimmed);
          if (users.length === 0) {
            throw new Error(`No Jira user found matching "${trimmed}"`);
          }
          const user = users[0];
          await assignIssue(clientConfig, issue.key, user.accountId);
          setIssues((prev) =>
            prev.map((i) => {
              const updated =
                i.id === issueId ? { ...i, assignee: user.displayName } : i;
              if (updated.blockingIssues) {
                updated.blockingIssues = updated.blockingIssues.map((b) =>
                  b.id === issueId ? { ...b, assignee: user.displayName } : b,
                );
              }
              return updated;
            }),
          );
        }
      } else if (field === "reporter") {
        const trimmed = value.trim();
        if (
          !trimmed ||
          trimmed === "-" ||
          trimmed.toLowerCase() === "unassigned"
        ) {
          await updateIssueFields(clientConfig, issue.key, { reporter: null });
          setIssues((prev) =>
            prev.map((i) => {
              const updated =
                i.id === issueId ? { ...i, reporter: undefined } : i;
              if (updated.blockingIssues) {
                updated.blockingIssues = updated.blockingIssues.map((b) =>
                  b.id === issueId ? { ...b, reporter: undefined } : b,
                );
              }
              return updated;
            }),
          );
        } else {
          const users = await searchJiraUsers(clientConfig, trimmed);
          if (users.length === 0) {
            throw new Error(`No Jira user found matching "${trimmed}"`);
          }
          const user = users[0];
          await updateIssueFields(clientConfig, issue.key, {
            reporter: { id: user.accountId },
          });
          setIssues((prev) =>
            prev.map((i) => {
              const updated =
                i.id === issueId ? { ...i, reporter: user.displayName } : i;
              if (updated.blockingIssues) {
                updated.blockingIssues = updated.blockingIssues.map((b) =>
                  b.id === issueId ? { ...b, reporter: user.displayName } : b,
                );
              }
              return updated;
            }),
          );
        }
      }
      setEditingCell(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update field");
      }
    } finally {
      setSavingCell(false);
    }
  };

  const handleAddBlockerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingBlockerFor || !blockerKeyInput.trim()) return;

    setAddingBlockerLoading(true);
    setAddingBlockerError(null);

    try {
      const clientConfig = {
        apiToken: apiKey,
        userEmail: userEmail,
        jiraDomain: jiraDomain,
        useProxy: true,
      };

      let cleanBlockerKey = blockerKeyInput.trim();
      const browseMatch = cleanBlockerKey.match(/\/browse\/([A-Za-z0-9-]+)/i);
      if (browseMatch && browseMatch[1]) {
        cleanBlockerKey = browseMatch[1];
      }
      cleanBlockerKey = cleanBlockerKey.toUpperCase();

      await addBlocker(clientConfig, addingBlockerFor.key, cleanBlockerKey);

      // Successfully linked. Now refresh issues list.
      await handleSearch();

      // Reset state and close modal
      setAddingBlockerFor(null);
      setBlockerKeyInput("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAddingBlockerError(err.message);
      } else {
        setAddingBlockerError("Failed to add blocker issue.");
      }
    } finally {
      setAddingBlockerLoading(false);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIssue(null);
        setAddingBlockerFor(null);
      }
    };
    if (selectedIssue || addingBlockerFor) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIssue, addingBlockerFor]);

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

  const handleSearch = async (searchQuery?: string) => {
    const activeQuery = searchQuery !== undefined ? searchQuery : filterId;
    if (!activeQuery) {
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
      const extraFields = activeColumns
        .filter(
          (col) =>
            !["key", "summary", "status", "assignee", "reporter"].includes(
              col.id,
            ),
        )
        .map((col) => col.id);

      const results = await getIssuesByFilter(
        {
          apiToken: apiKey,
          userEmail: userEmail,
          jiraDomain: jiraDomain,
          useProxy: true,
        },
        activeQuery,
        extraFields,
      );

      // Extract unique blocker issue keys
      const blockerKeys = new Set<string>();
      results.forEach((issue) => {
        issue.blockingIssues?.forEach((blocker) => {
          if (blocker.key) {
            blockerKeys.add(blocker.key);
          }
        });
      });

      if (blockerKeys.size > 0) {
        try {
          const jql = `key in (${Array.from(blockerKeys)
            .map((k) => `"${k}"`)
            .join(",")})`;
          const blockerDetails = await getIssuesByFilter(
            {
              apiToken: apiKey,
              userEmail: userEmail,
              jiraDomain: jiraDomain,
              useProxy: true,
            },
            jql,
            extraFields,
          );

          const blockerLookup = new Map<string, Issue>();
          blockerDetails.forEach((detail) => {
            blockerLookup.set(detail.key, detail);
          });

          results.forEach((issue) => {
            if (issue.blockingIssues) {
              issue.blockingIssues = issue.blockingIssues.map((blocker) => {
                const detailed = blockerLookup.get(blocker.key);
                if (detailed) {
                  return {
                    ...blocker,
                    ...detailed,
                  };
                }
                return blocker;
              });
            }
          });
        } catch (e) {
          console.error("Failed to enrich blocker issues details", e);
        }
      }

      setIssues(results);
      addToHistory(activeQuery);
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

  const performSearch = () => {
    const trimmed = filterId.trim();
    if (!trimmed) {
      setError("Please enter a Filter ID or JQL");
      return;
    }
    if (trimmed === queryParam) {
      handleSearch(trimmed);
    } else {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("q", trimmed);
      setSearchParams(nextParams);
    }
  };

  React.useEffect(() => {
    if (queryParam) {
      handleSearch(queryParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam, colsParam]);

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
          onKeyDown={(e) => e.key === "Enter" && performSearch()}
        />
        <button
          className="btn-primary"
          style={{ padding: "0.5rem 1.5rem" }}
          onClick={performSearch}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
        <button
          className="glass-panel"
          style={{
            padding: "0.5rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            transition: "all var(--transition-fast)",
            height: "100%",
            margin: 0,
          }}
          onClick={() => setIsConfigOpen(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(102, 252, 241, 0.1)";
            e.currentTarget.style.borderColor = "var(--accent-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
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
            <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
          </svg>
          Columns
        </button>
        <div
          style={{
            height: "24px",
            width: "1px",
            background: "var(--border-color)",
          }}
        />
        <div style={{ position: "relative", width: "250px" }}>
          <span
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
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
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            className="input-field"
            style={{
              padding: "0.5rem 2rem 0.5rem 2.2rem",
              margin: 0,
              width: "100%",
              fontSize: "0.875rem",
            }}
            placeholder="Filter loaded rows..."
            value={rowFilterQuery}
            onChange={(e) => setRowFilterQuery(e.target.value)}
          />
          {rowFilterQuery && (
            <button
              onClick={() => setRowFilterQuery("")}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color var(--transition-fast)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent-secondary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-secondary)")
              }
              title="Clear filter"
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
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
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
                if (query === queryParam) {
                  handleSearch(query);
                } else {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set("q", query);
                  setSearchParams(nextParams);
                }
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
                {/* 1. Prefix Chevron Column Header */}
                <th
                  style={{
                    padding: "0.5rem 0.5rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "40px",
                    textAlign: "center",
                  }}
                ></th>

                {/* 2. Dynamic Configurable Columns Header */}
                {activeColumns.map((col) => {
                  const isSorted = sortConfig?.key === col.id;
                  const isDesc = sortConfig?.direction === "desc";
                  return (
                    <th
                      key={col.id}
                      onClick={() => handleSort(col.id)}
                      className="sortable-header"
                      style={{
                        padding: "0.5rem 1rem",
                        borderBottom: "1px solid var(--border-color)",
                        width:
                          col.id === "key"
                            ? "120px"
                            : col.id === "status" ||
                                col.id === "assignee" ||
                                col.id === "reporter"
                              ? "150px"
                              : undefined,
                      }}
                    >
                      <div className="sortable-header-content">
                        <span>{col.name}</span>
                        <span
                          className={`sort-icon ${isSorted ? "active" : ""}`}
                          style={{
                            transform: isDesc
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <polyline points="19 12 12 19 5 12"></polyline>
                          </svg>
                        </span>
                      </div>
                    </th>
                  );
                })}

                {/* 3. Suffix Actions Column Header */}
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    borderBottom: "1px solid var(--border-color)",
                    width: "100px",
                    textAlign: "center",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedIssues.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={activeColumns.length + 2}
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
                    colSpan={activeColumns.length + 2}
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
                sortedIssues.map((issue) => (
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
                      {/* 1. Prefix Chevron Cell */}
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

                      {/* 2. Dynamic Content Cells */}
                      {activeColumns.map((col) => {
                        if (col.id === "key") {
                          return (
                            <td key={col.id} style={{ padding: "0.5rem 1rem" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
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
                                {issue.blockedBy &&
                                  issue.blockedBy.length > 0 && (
                                    <span
                                      title={`Blocked by ${issue.blockedBy.map((b) => b.key).join(", ")}`}
                                      style={{
                                        color: "#ff6b6b",
                                        display: "inline-flex",
                                        alignItems: "center",
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
                                    </span>
                                  )}
                              </div>
                            </td>
                          );
                        }

                        if (col.id === "summary") {
                          return (
                            <td
                              key={col.id}
                              style={{
                                padding: "0.5rem 1rem",
                                color: "var(--text-primary)",
                                maxWidth: "400px",
                              }}
                              onDoubleClick={() => {
                                if (!savingCell) {
                                  setEditingCell({
                                    issueId: issue.id,
                                    field: "summary",
                                  });
                                  setEditValue(issue.summary);
                                }
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.25rem",
                                }}
                              >
                                {editingCell?.issueId === issue.id &&
                                editingCell?.field === "summary" ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                    }}
                                  >
                                    <input
                                      type="text"
                                      className="input-field"
                                      style={{
                                        width: "100%",
                                        padding: "2px 6px",
                                        margin: 0,
                                        fontSize: "0.85rem",
                                        background: "rgba(0, 0, 0, 0.5)",
                                        border:
                                          "1px solid var(--accent-secondary)",
                                      }}
                                      value={editValue}
                                      onChange={(e) =>
                                        setEditValue(e.target.value)
                                      }
                                      onBlur={() =>
                                        handleInlineSave(
                                          issue.id,
                                          "summary",
                                          editValue,
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleInlineSave(
                                            issue.id,
                                            "summary",
                                            editValue,
                                          );
                                        } else if (e.key === "Escape") {
                                          setEditingCell(null);
                                        }
                                      }}
                                      autoFocus
                                      disabled={savingCell}
                                    />
                                    {savingCell && (
                                      <span
                                        className="spinner"
                                        style={{
                                          display: "inline-block",
                                          width: "12px",
                                          height: "12px",
                                          border:
                                            "1px solid rgba(255,255,255,0.3)",
                                          borderTop:
                                            "1px solid var(--accent-secondary)",
                                          borderRadius: "50%",
                                          animation: "spin 1s linear infinite",
                                          flexShrink: 0,
                                        }}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    title="Double-click to edit summary"
                                    style={{
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      cursor: "text",
                                      padding: "2px 0",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                    }}
                                  >
                                    <span>{issue.summary}</span>
                                    {savingCell &&
                                      editingCell?.issueId === issue.id &&
                                      editingCell?.field === "summary" && (
                                        <span
                                          className="spinner"
                                          style={{
                                            display: "inline-block",
                                            width: "12px",
                                            height: "12px",
                                            border:
                                              "1px solid rgba(255,255,255,0.3)",
                                            borderTop:
                                              "1px solid var(--accent-secondary)",
                                            borderRadius: "50%",
                                            animation:
                                              "spin 1s linear infinite",
                                          }}
                                        />
                                      )}
                                  </div>
                                )}
                                {issue.blockedBy &&
                                  issue.blockedBy.length > 0 && (
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "0.35rem",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {issue.blockedBy.map((blocker) => (
                                        <a
                                          key={blocker.id}
                                          href={blocker.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          title={`Blocked by ${blocker.key}: ${blocker.summary}`}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.25rem",
                                            background:
                                              "rgba(255, 107, 107, 0.12)",
                                            border:
                                              "1px solid rgba(255, 107, 107, 0.25)",
                                            color: "#ff8787",
                                            padding: "0.1rem 0.4rem",
                                            borderRadius: "4px",
                                            fontSize: "0.7rem",
                                            fontWeight: "600",
                                            textDecoration: "none",
                                            transition:
                                              "all var(--transition-fast)",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                              "rgba(255, 107, 107, 0.25)";
                                            e.currentTarget.style.borderColor =
                                              "#ff6b6b";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                              "rgba(255, 107, 107, 0.12)";
                                            e.currentTarget.style.borderColor =
                                              "rgba(255, 107, 107, 0.25)";
                                          }}
                                        >
                                          <svg
                                            width="10"
                                            height="10"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
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
                                          <span>Blocked by {blocker.key}</span>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            </td>
                          );
                        }

                        if (col.id === "status") {
                          return (
                            <td
                              key={col.id}
                              style={{
                                padding: "0.5rem 1rem",
                                cursor: "pointer",
                              }}
                              onDoubleClick={() => {
                                if (!savingCell) {
                                  startEditingStatus(issue);
                                }
                              }}
                            >
                              {editingCell?.issueId === issue.id &&
                              editingCell?.field === "status" ? (
                                loadingTransitionsIssueId === issue.id ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                    }}
                                  >
                                    <div
                                      className="spinner"
                                      style={{
                                        width: "12px",
                                        height: "12px",
                                        border:
                                          "1px solid rgba(255,255,255,0.3)",
                                        borderTop:
                                          "1px solid var(--accent-secondary)",
                                        borderRadius: "50%",
                                        animation: "spin 1s linear infinite",
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      Loading...
                                    </span>
                                  </div>
                                ) : (
                                  <select
                                    className="input-field"
                                    style={{
                                      width: "100%",
                                      padding: "2px 6px",
                                      margin: 0,
                                      fontSize: "0.8rem",
                                      background: "var(--bg-secondary)",
                                      border:
                                        "1px solid var(--accent-secondary)",
                                      color: "var(--text-primary)",
                                      borderRadius: "4px",
                                    }}
                                    value={editValue}
                                    onChange={(e) => {
                                      const selectedName = e.target.value;
                                      const tr = transitionsMap[issue.id]?.find(
                                        (t) => t.name === selectedName,
                                      );
                                      if (tr) {
                                        handleTransitionSave(
                                          issue.id,
                                          tr.id,
                                          tr.name,
                                        );
                                      }
                                    }}
                                    onBlur={() => setEditingCell(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setEditingCell(null);
                                      }
                                    }}
                                    autoFocus
                                    disabled={savingCell}
                                  >
                                    <option value={issue.status}>
                                      {issue.status}
                                    </option>
                                    {(transitionsMap[issue.id] || [])
                                      .filter((t) => t.name !== issue.status)
                                      .map((t) => (
                                        <option key={t.id} value={t.name}>
                                          {t.name}
                                        </option>
                                      ))}
                                  </select>
                                )
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                  }}
                                >
                                  <span
                                    title="Double-click to change status"
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
                                  {savingCell &&
                                    editingCell?.issueId === issue.id &&
                                    editingCell?.field === "status" && (
                                      <div
                                        className="spinner"
                                        style={{
                                          width: "12px",
                                          height: "12px",
                                          border:
                                            "1px solid rgba(255,255,255,0.3)",
                                          borderTop:
                                            "1px solid var(--accent-secondary)",
                                          borderRadius: "50%",
                                          animation: "spin 1s linear infinite",
                                        }}
                                      />
                                    )}
                                </div>
                              )}
                            </td>
                          );
                        }

                        if (col.id === "assignee") {
                          return (
                            <td
                              key={col.id}
                              style={{
                                padding: "0.5rem 1rem",
                                color: "var(--text-secondary)",
                                cursor: "text",
                              }}
                              onDoubleClick={() => {
                                if (!savingCell) {
                                  setEditingCell({
                                    issueId: issue.id,
                                    field: "assignee",
                                  });
                                  setEditValue(issue.assignee || "");
                                }
                              }}
                            >
                              {editingCell?.issueId === issue.id &&
                              editingCell?.field === "assignee" ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                >
                                  <input
                                    type="text"
                                    className="input-field"
                                    style={{
                                      width: "100%",
                                      padding: "2px 6px",
                                      margin: 0,
                                      fontSize: "0.85rem",
                                      background: "rgba(0, 0, 0, 0.5)",
                                      border:
                                        "1px solid var(--accent-secondary)",
                                    }}
                                    placeholder="Name/Email or -"
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
                                    onBlur={() =>
                                      handleInlineSave(
                                        issue.id,
                                        "assignee",
                                        editValue,
                                      )
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleInlineSave(
                                          issue.id,
                                          "assignee",
                                          editValue,
                                        );
                                      } else if (e.key === "Escape") {
                                        setEditingCell(null);
                                      }
                                    }}
                                    autoFocus
                                    disabled={savingCell}
                                  />
                                  {savingCell && (
                                    <div
                                      className="spinner"
                                      style={{
                                        width: "12px",
                                        height: "12px",
                                        border:
                                          "1px solid rgba(255,255,255,0.3)",
                                        borderTop:
                                          "1px solid var(--accent-secondary)",
                                        borderRadius: "50%",
                                        animation: "spin 1s linear infinite",
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div
                                  title="Double-click to edit assignee"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                  }}
                                >
                                  <span>{issue.assignee || "-"}</span>
                                  {savingCell &&
                                    editingCell?.issueId === issue.id &&
                                    editingCell?.field === "assignee" && (
                                      <div
                                        className="spinner"
                                        style={{
                                          width: "12px",
                                          height: "12px",
                                          border:
                                            "1px solid rgba(255,255,255,0.3)",
                                          borderTop:
                                            "1px solid var(--accent-secondary)",
                                          borderRadius: "50%",
                                          animation: "spin 1s linear infinite",
                                        }}
                                      />
                                    )}
                                </div>
                              )}
                            </td>
                          );
                        }

                        if (col.id === "reporter") {
                          return (
                            <td
                              key={col.id}
                              style={{
                                padding: "0.5rem 1rem",
                                color: "var(--text-secondary)",
                                cursor: "text",
                              }}
                              onDoubleClick={() => {
                                if (!savingCell) {
                                  setEditingCell({
                                    issueId: issue.id,
                                    field: "reporter",
                                  });
                                  setEditValue(issue.reporter || "");
                                }
                              }}
                            >
                              {editingCell?.issueId === issue.id &&
                              editingCell?.field === "reporter" ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                >
                                  <input
                                    type="text"
                                    className="input-field"
                                    style={{
                                      width: "100%",
                                      padding: "2px 6px",
                                      margin: 0,
                                      fontSize: "0.85rem",
                                      background: "rgba(0, 0, 0, 0.5)",
                                      border:
                                        "1px solid var(--accent-secondary)",
                                    }}
                                    placeholder="Name/Email or -"
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
                                    onBlur={() =>
                                      handleInlineSave(
                                        issue.id,
                                        "reporter",
                                        editValue,
                                      )
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleInlineSave(
                                          issue.id,
                                          "reporter",
                                          editValue,
                                        );
                                      } else if (e.key === "Escape") {
                                        setEditingCell(null);
                                      }
                                    }}
                                    autoFocus
                                    disabled={savingCell}
                                  />
                                  {savingCell && (
                                    <div
                                      className="spinner"
                                      style={{
                                        width: "12px",
                                        height: "12px",
                                        border:
                                          "1px solid rgba(255,255,255,0.3)",
                                        borderTop:
                                          "1px solid var(--accent-secondary)",
                                        borderRadius: "50%",
                                        animation: "spin 1s linear infinite",
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div
                                  title="Double-click to edit reporter"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                  }}
                                >
                                  <span>{issue.reporter || "-"}</span>
                                  {savingCell &&
                                    editingCell?.issueId === issue.id &&
                                    editingCell?.field === "reporter" && (
                                      <div
                                        className="spinner"
                                        style={{
                                          width: "12px",
                                          height: "12px",
                                          border:
                                            "1px solid rgba(255,255,255,0.3)",
                                          borderTop:
                                            "1px solid var(--accent-secondary)",
                                          borderRadius: "50%",
                                          animation: "spin 1s linear infinite",
                                        }}
                                      />
                                    )}
                                </div>
                              )}
                            </td>
                          );
                        }

                        // Render other fields or custom fields
                        const val = issue.customFields
                          ? issue.customFields[col.id]
                          : (issue as unknown as Record<string, unknown>)[
                              col.id
                            ];
                        return (
                          <td
                            key={col.id}
                            style={{
                              padding: "0.5rem 1rem",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <div
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "200px",
                              }}
                              title={formatFieldValue(val)}
                            >
                              {formatFieldValue(val)}
                            </div>
                          </td>
                        );
                      })}

                      {/* 3. Suffix Actions Cell */}
                      <td
                        style={{
                          padding: "0.5rem 1rem",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            justifyContent: "center",
                            alignItems: "center",
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
                          <button
                            onClick={() => setAddingBlockerFor(issue)}
                            aria-label="Add blocker issue"
                            title="Add blocker"
                            style={{
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "#ff6b6b",
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
                                "rgba(255, 107, 107, 0.15)";
                              e.currentTarget.style.borderColor = "#ff6b6b";
                              e.currentTarget.style.boxShadow =
                                "0 0 10px rgba(255, 107, 107, 0.3)";
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
                              <line x1="12" y1="15" x2="12" y2="19"></line>
                              <line x1="10" y1="17" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
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
                          {/* 1. Indentation Arrow prefix */}
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

                          {/* 2. Dynamic Blocker columns alignment */}
                          {activeColumns.map((col) => {
                            if (col.id === "key") {
                              return (
                                <td
                                  key={col.id}
                                  style={{ padding: "0.5rem 1rem 0.5rem 2rem" }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.35rem",
                                    }}
                                  >
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="#ff6b6b"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      style={{ flexShrink: 0 }}
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
                                    <a
                                      href={blocker.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: "#ff6b6b",
                                        textDecoration: "none",
                                        fontSize: "0.8rem",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {blocker.key}
                                    </a>
                                  </div>
                                </td>
                              );
                            }
                            if (col.id === "summary") {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: "0.5rem 1rem",
                                    color: "var(--text-primary)",
                                    maxWidth: "400px",
                                  }}
                                  onDoubleClick={() => {
                                    if (!savingCell) {
                                      setEditingCell({
                                        issueId: blocker.id,
                                        field: "summary",
                                      });
                                      setEditValue(blocker.summary);
                                    }
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    {editingCell?.issueId === blocker.id &&
                                    editingCell?.field === "summary" ? (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.5rem",
                                        }}
                                      >
                                        <input
                                          type="text"
                                          className="input-field"
                                          style={{
                                            width: "100%",
                                            padding: "2px 6px",
                                            margin: 0,
                                            fontSize: "0.85rem",
                                            background: "rgba(0, 0, 0, 0.5)",
                                            border:
                                              "1px solid var(--accent-secondary)",
                                          }}
                                          value={editValue}
                                          onChange={(e) =>
                                            setEditValue(e.target.value)
                                          }
                                          onBlur={() =>
                                            handleInlineSave(
                                              blocker.id,
                                              "summary",
                                              editValue,
                                            )
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              handleInlineSave(
                                                blocker.id,
                                                "summary",
                                                editValue,
                                              );
                                            } else if (e.key === "Escape") {
                                              setEditingCell(null);
                                            }
                                          }}
                                          autoFocus
                                          disabled={savingCell}
                                        />
                                        {savingCell && (
                                          <span
                                            className="spinner"
                                            style={{
                                              display: "inline-block",
                                              width: "12px",
                                              height: "12px",
                                              border:
                                                "1px solid rgba(255,255,255,0.3)",
                                              borderTop:
                                                "1px solid var(--accent-secondary)",
                                              borderRadius: "50%",
                                              animation:
                                                "spin 1s linear infinite",
                                              flexShrink: 0,
                                            }}
                                          />
                                        )}
                                      </div>
                                    ) : (
                                      <div
                                        title="Double-click to edit summary"
                                        style={{
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          cursor: "text",
                                          padding: "2px 0",
                                          fontStyle: "italic",
                                          color: "var(--text-secondary)",
                                          fontSize: "0.8rem",
                                        }}
                                      >
                                        {blocker.summary}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            if (col.id === "status") {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: "0.5rem 1rem",
                                    cursor: "pointer",
                                  }}
                                  onDoubleClick={() => {
                                    if (!savingCell) {
                                      startEditingStatus(blocker);
                                    }
                                  }}
                                >
                                  {editingCell?.issueId === blocker.id &&
                                  editingCell?.field === "status" ? (
                                    loadingTransitionsIssueId === blocker.id ? (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.5rem",
                                        }}
                                      >
                                        <div
                                          className="spinner"
                                          style={{
                                            width: "12px",
                                            height: "12px",
                                            border:
                                              "1px solid rgba(255,255,255,0.3)",
                                            borderTop:
                                              "1px solid var(--accent-secondary)",
                                            borderRadius: "50%",
                                            animation:
                                              "spin 1s linear infinite",
                                          }}
                                        />
                                        <span
                                          style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-secondary)",
                                          }}
                                        >
                                          Loading...
                                        </span>
                                      </div>
                                    ) : (
                                      <select
                                        className="input-field"
                                        style={{
                                          width: "100%",
                                          padding: "2px 6px",
                                          margin: 0,
                                          fontSize: "0.8rem",
                                          background: "var(--bg-secondary)",
                                          border:
                                            "1px solid var(--accent-secondary)",
                                          color: "var(--text-primary)",
                                          borderRadius: "4px",
                                        }}
                                        value={editValue}
                                        onChange={(e) => {
                                          const selectedName = e.target.value;
                                          const tr = transitionsMap[
                                            blocker.id
                                          ]?.find(
                                            (t) => t.name === selectedName,
                                          );
                                          if (tr) {
                                            handleTransitionSave(
                                              blocker.id,
                                              tr.id,
                                              tr.name,
                                            );
                                          }
                                        }}
                                        onBlur={() => setEditingCell(null)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Escape") {
                                            setEditingCell(null);
                                          }
                                        }}
                                        autoFocus
                                        disabled={savingCell}
                                      >
                                        <option value={blocker.status}>
                                          {blocker.status}
                                        </option>
                                        {(transitionsMap[blocker.id] || [])
                                          .filter(
                                            (t) => t.name !== blocker.status,
                                          )
                                          .map((t) => (
                                            <option key={t.id} value={t.name}>
                                              {t.name}
                                            </option>
                                          ))}
                                      </select>
                                    )
                                  ) : (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      <span
                                        title="Double-click to change status"
                                        style={{
                                          background:
                                            "rgba(255, 107, 107, 0.15)",
                                          color: "#ff8787",
                                          padding: "0.05rem 0.4rem",
                                          borderRadius: "4px",
                                          fontSize: "0.7rem",
                                          fontWeight: "600",
                                        }}
                                      >
                                        {blocker.status}
                                      </span>
                                      {savingCell &&
                                        editingCell?.issueId === blocker.id &&
                                        editingCell?.field === "status" && (
                                          <div
                                            className="spinner"
                                            style={{
                                              width: "12px",
                                              height: "12px",
                                              border:
                                                "1px solid rgba(255,255,255,0.3)",
                                              borderTop:
                                                "1px solid var(--accent-secondary)",
                                              borderRadius: "50%",
                                              animation:
                                                "spin 1s linear infinite",
                                            }}
                                          />
                                        )}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            if (col.id === "assignee") {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: "0.5rem 1rem",
                                    color: "var(--text-secondary)",
                                    cursor: "text",
                                  }}
                                  onDoubleClick={() => {
                                    if (!savingCell) {
                                      setEditingCell({
                                        issueId: blocker.id,
                                        field: "assignee",
                                      });
                                      setEditValue(blocker.assignee || "");
                                    }
                                  }}
                                >
                                  {editingCell?.issueId === blocker.id &&
                                  editingCell?.field === "assignee" ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                      }}
                                    >
                                      <input
                                        type="text"
                                        className="input-field"
                                        style={{
                                          width: "100%",
                                          padding: "2px 6px",
                                          margin: 0,
                                          fontSize: "0.85rem",
                                          background: "rgba(0, 0, 0, 0.5)",
                                          border:
                                            "1px solid var(--accent-secondary)",
                                        }}
                                        placeholder="Name/Email or -"
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={() =>
                                          handleInlineSave(
                                            blocker.id,
                                            "assignee",
                                            editValue,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleInlineSave(
                                              blocker.id,
                                              "assignee",
                                              editValue,
                                            );
                                          } else if (e.key === "Escape") {
                                            setEditingCell(null);
                                          }
                                        }}
                                        autoFocus
                                        disabled={savingCell}
                                      />
                                      {savingCell && (
                                        <div
                                          className="spinner"
                                          style={{
                                            width: "12px",
                                            height: "12px",
                                            border:
                                              "1px solid rgba(255,255,255,0.3)",
                                            borderTop:
                                              "1px solid var(--accent-secondary)",
                                            borderRadius: "50%",
                                            animation:
                                              "spin 1s linear infinite",
                                            flexShrink: 0,
                                          }}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      title="Double-click to edit assignee"
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      <span>{blocker.assignee || "-"}</span>
                                      {savingCell &&
                                        editingCell?.issueId === blocker.id &&
                                        editingCell?.field === "assignee" && (
                                          <div
                                            className="spinner"
                                            style={{
                                              width: "12px",
                                              height: "12px",
                                              border:
                                                "1px solid rgba(255,255,255,0.3)",
                                              borderTop:
                                                "1px solid var(--accent-secondary)",
                                              borderRadius: "50%",
                                              animation:
                                                "spin 1s linear infinite",
                                            }}
                                          />
                                        )}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            if (col.id === "reporter") {
                              return (
                                <td
                                  key={col.id}
                                  style={{
                                    padding: "0.5rem 1rem",
                                    color: "var(--text-secondary)",
                                    cursor: "text",
                                  }}
                                  onDoubleClick={() => {
                                    if (!savingCell) {
                                      setEditingCell({
                                        issueId: blocker.id,
                                        field: "reporter",
                                      });
                                      setEditValue(blocker.reporter || "");
                                    }
                                  }}
                                >
                                  {editingCell?.issueId === blocker.id &&
                                  editingCell?.field === "reporter" ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                      }}
                                    >
                                      <input
                                        type="text"
                                        className="input-field"
                                        style={{
                                          width: "100%",
                                          padding: "2px 6px",
                                          margin: 0,
                                          fontSize: "0.85rem",
                                          background: "rgba(0, 0, 0, 0.5)",
                                          border:
                                            "1px solid var(--accent-secondary)",
                                        }}
                                        placeholder="Name/Email or -"
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        onBlur={() =>
                                          handleInlineSave(
                                            blocker.id,
                                            "reporter",
                                            editValue,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleInlineSave(
                                              blocker.id,
                                              "reporter",
                                              editValue,
                                            );
                                          } else if (e.key === "Escape") {
                                            setEditingCell(null);
                                          }
                                        }}
                                        autoFocus
                                        disabled={savingCell}
                                      />
                                      {savingCell && (
                                        <div
                                          className="spinner"
                                          style={{
                                            width: "12px",
                                            height: "12px",
                                            border:
                                              "1px solid rgba(255,255,255,0.3)",
                                            borderTop:
                                              "1px solid var(--accent-secondary)",
                                            borderRadius: "50%",
                                            animation:
                                              "spin 1s linear infinite",
                                            flexShrink: 0,
                                          }}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      title="Double-click to edit reporter"
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      <span>{blocker.reporter || "-"}</span>
                                      {savingCell &&
                                        editingCell?.issueId === blocker.id &&
                                        editingCell?.field === "reporter" && (
                                          <div
                                            className="spinner"
                                            style={{
                                              width: "12px",
                                              height: "12px",
                                              border:
                                                "1px solid rgba(255,255,255,0.3)",
                                              borderTop:
                                                "1px solid var(--accent-secondary)",
                                              borderRadius: "50%",
                                              animation:
                                                "spin 1s linear infinite",
                                            }}
                                          />
                                        )}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            // Render other fields or custom fields from the blocker issue!
                            const val = blocker.customFields
                              ? blocker.customFields[col.id]
                              : (blocker as unknown as Record<string, unknown>)[
                                  col.id
                                ];
                            return (
                              <td
                                key={col.id}
                                style={{
                                  padding: "0.5rem 1rem",
                                  color: "var(--text-secondary)",
                                  fontSize: "0.8rem",
                                }}
                              >
                                <div
                                  style={{
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: "200px",
                                  }}
                                  title={formatFieldValue(val)}
                                >
                                  {formatFieldValue(val)}
                                </div>
                              </td>
                            );
                          })}

                          {/* 3. Suffix empty details cell */}
                          <td></td>
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
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
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
                {/* Blocked Alert Banner */}
                {selectedIssue.blockedBy &&
                  selectedIssue.blockedBy.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        background: "rgba(255, 107, 107, 0.1)",
                        border: "1px solid rgba(255, 107, 107, 0.25)",
                        borderRadius: "8px",
                        padding: "0.75rem 1rem",
                        color: "#ff8787",
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
                      <div style={{ fontSize: "0.85rem", lineHeight: "1.4" }}>
                        <strong>Blocked:</strong> This issue is blocked by{" "}
                        {selectedIssue.blockedBy.map((blocker, idx) => (
                          <React.Fragment key={blocker.id}>
                            {idx > 0 && ", "}
                            <a
                              href={blocker.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#ff6b6b",
                                fontWeight: "600",
                                textDecoration: "none",
                                borderBottom:
                                  "1px dashed rgba(255, 107, 107, 0.4)",
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

      {/* Add Blocker Modal */}
      {addingBlockerFor && (
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
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            boxSizing: "border-box",
            animation: "modalFadeIn 0.3s ease-out forwards",
          }}
          onClick={() => {
            if (!addingBlockerLoading) {
              setAddingBlockerFor(null);
              setBlockerKeyInput("");
              setAddingBlockerError(null);
            }
          }}
        >
          <div
            style={{
              background: "rgba(31, 40, 51, 0.95)",
              border: "1px solid rgba(255, 107, 107, 0.3)",
              borderRadius: "16px",
              boxShadow:
                "0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 1px 1px rgba(255, 255, 255, 0.1)",
              width: "100%",
              maxWidth: "500px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation:
                "modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255, 107, 107, 0.03)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  color: "#ff8787",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
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
                  <line x1="12" y1="15" x2="12" y2="19"></line>
                  <line x1="10" y1="17" x2="14" y2="17"></line>
                </svg>
                Add Blocker to {addingBlockerFor.key}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAddingBlockerFor(null);
                  setBlockerKeyInput("");
                  setAddingBlockerError(null);
                }}
                disabled={addingBlockerLoading}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color var(--transition-fast)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
              >
                &times;
              </button>
            </div>

            {/* Modal Body Form */}
            <form
              onSubmit={handleAddBlockerSubmit}
              style={{ padding: "1.5rem" }}
            >
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  htmlFor="blocker-key-input"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-secondary)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Blocker Issue Key or ID
                </label>
                <input
                  id="blocker-key-input"
                  type="text"
                  placeholder="e.g. PROJ-123"
                  className="input-field"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.6rem 0.75rem",
                    fontSize: "0.95rem",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    outline: "none",
                    transition: "border-color var(--transition-fast)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#ff6b6b")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border-color)")
                  }
                  value={blockerKeyInput}
                  onChange={(e) => setBlockerKeyInput(e.target.value)}
                  autoFocus
                  disabled={addingBlockerLoading}
                  required
                />
              </div>

              {addingBlockerError && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "rgba(255, 99, 71, 0.15)",
                    color: "#ff8787",
                    border: "1px solid rgba(255, 99, 71, 0.3)",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <strong>Error:</strong> {addingBlockerError}
                </div>
              )}

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAddingBlockerFor(null);
                    setBlockerKeyInput("");
                    setAddingBlockerError(null);
                  }}
                  disabled={addingBlockerLoading}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    if (!addingBlockerLoading) {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.1)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingBlockerLoading || !blockerKeyInput.trim()}
                  style={{
                    background: "rgba(255, 107, 107, 0.2)",
                    border: "1px solid rgba(255, 107, 107, 0.4)",
                    borderRadius: "6px",
                    padding: "0.5rem 1.25rem",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "#ff8787",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    transition: "all var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    if (!addingBlockerLoading && blockerKeyInput.trim()) {
                      e.currentTarget.style.background =
                        "rgba(255, 107, 107, 0.3)";
                      e.currentTarget.style.borderColor = "#ff6b6b";
                      e.currentTarget.style.boxShadow =
                        "0 0 10px rgba(255, 107, 107, 0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255, 107, 107, 0.2)";
                    e.currentTarget.style.borderColor =
                      "rgba(255, 107, 107, 0.4)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {addingBlockerLoading ? (
                    <>
                      <div
                        className="spinner"
                        style={{
                          width: "12px",
                          height: "12px",
                          border: "1px solid rgba(255, 107, 107, 0.3)",
                          borderTop: "1px solid #ff8787",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Adding...
                    </>
                  ) : (
                    "Add Blocker"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Columns Configuration Drawer */}
      {isConfigOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(11, 12, 16, 0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1100,
            display: "flex",
            justifyContent: "flex-end",
            animation: "modalFadeIn 0.25s ease-out forwards",
          }}
          onClick={() => setIsConfigOpen(false)}
        >
          <div
            style={{
              width: "450px",
              maxWidth: "100vw",
              height: "100%",
              background: "var(--background-dark)",
              borderLeft: "1px solid var(--border-color)",
              boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              animation:
                "drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "1.5rem",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "var(--text-primary)",
                    fontSize: "1.2rem",
                    fontWeight: "600",
                  }}
                >
                  Configure Columns
                </h3>
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Reorder, toggle, or add custom fields to list view
                </p>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "rgba(255, 255, 255, 0.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {/* Section 1: Active Columns (Reorder & Toggle) */}
              <div>
                <h4
                  style={{
                    margin: "0 0 0.75rem 0",
                    color: "var(--text-primary)",
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Active Columns ({activeColumns.length})
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {activeColumns.map((col, index) => {
                    const isCore = col.id === "key" || col.id === "summary";
                    return (
                      <div
                        key={col.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.6rem 0.75rem",
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          gap: "0.5rem",
                        }}
                      >
                        {/* Drag indicator & label */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              cursor: "grab",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="9" cy="5" r="1"></circle>
                              <circle cx="9" cy="12" r="1"></circle>
                              <circle cx="9" cy="19" r="1"></circle>
                              <circle cx="15" cy="5" r="1"></circle>
                              <circle cx="15" cy="12" r="1"></circle>
                              <circle cx="15" cy="19" r="1"></circle>
                            </svg>
                          </div>
                          <span
                            style={{
                              color: "var(--text-primary)",
                              fontSize: "0.85rem",
                              fontWeight: "500",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {col.name}
                          </span>
                          {col.isCustom && (
                            <span
                              style={{
                                background: "rgba(102, 252, 241, 0.1)",
                                color: "var(--accent-primary)",
                                fontSize: "0.65rem",
                                padding: "0.1rem 0.3rem",
                                borderRadius: "4px",
                                textTransform: "uppercase",
                              }}
                            >
                              Jira Custom
                            </span>
                          )}
                        </div>

                        {/* Reorder & toggle controls */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          {/* Move Up */}
                          <button
                            onClick={() => moveColumn(index, -1)}
                            disabled={index === 0}
                            style={{
                              background: "none",
                              border: "none",
                              color:
                                index === 0
                                  ? "rgba(255,255,255,0.15)"
                                  : "var(--text-secondary)",
                              cursor: index === 0 ? "not-allowed" : "pointer",
                              padding: "0.2rem",
                              borderRadius: "4px",
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => moveColumn(index, 1)}
                            disabled={index === activeColumns.length - 1}
                            style={{
                              background: "none",
                              border: "none",
                              color:
                                index === activeColumns.length - 1
                                  ? "rgba(255,255,255,0.15)"
                                  : "var(--text-secondary)",
                              cursor:
                                index === activeColumns.length - 1
                                  ? "not-allowed"
                                  : "pointer",
                              padding: "0.2rem",
                              borderRadius: "4px",
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>

                          {/* Toggle active / deactivate */}
                          <button
                            onClick={() => toggleColumnActive(col.id)}
                            disabled={isCore}
                            style={{
                              background: "none",
                              border: "none",
                              color: isCore
                                ? "rgba(255,255,255,0.1)"
                                : "#ff6b6b",
                              cursor: isCore ? "not-allowed" : "pointer",
                              padding: "0.2rem",
                              marginLeft: "0.25rem",
                              borderRadius: "4px",
                            }}
                            title={
                              isCore
                                ? "Core column cannot be removed"
                                : "Remove column"
                            }
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="15" y1="9" x2="9" y2="15"></line>
                              <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Inactive Standard/Custom Columns */}
              {allColumns.filter(
                (c) => !activeColumns.some((ac) => ac.id === c.id),
              ).length > 0 && (
                <div>
                  <h4
                    style={{
                      margin: "0 0 0.75rem 0",
                      color: "var(--text-primary)",
                      fontSize: "0.9rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Available Columns
                  </h4>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                  >
                    {allColumns
                      .filter(
                        (c) => !activeColumns.some((ac) => ac.id === c.id),
                      )
                      .map((col) => (
                        <button
                          key={col.id}
                          onClick={() => toggleColumnActive(col.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.4rem 0.75rem",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px dashed var(--border-color)",
                            borderRadius: "20px",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor =
                              "var(--accent-primary)";
                            e.currentTarget.style.color = "var(--text-primary)";
                            e.currentTarget.style.background =
                              "rgba(102, 252, 241, 0.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor =
                              "var(--border-color)";
                            e.currentTarget.style.color =
                              "var(--text-secondary)";
                            e.currentTarget.style.background =
                              "rgba(255,255,255,0.03)";
                          }}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                          {col.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Section 3: Add Jira Custom Field */}
              <div
                style={{
                  borderTop: "1px solid var(--border-color)",
                  paddingTop: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    color: "var(--text-primary)",
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Add Jira Custom Field
                </h4>

                {/* Option A: Select from Server */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      fontWeight: "500",
                    }}
                  >
                    Select from Jira Server fields:
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <select
                      value={selectedJiraFieldId}
                      onChange={(e) => setSelectedJiraFieldId(e.target.value)}
                      style={{
                        flex: 1,
                        background: "var(--background-dark)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        padding: "0.5rem",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    >
                      <option value="">-- Choose Field --</option>
                      {availableCustomFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name} ({field.id})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddSelectedJiraField}
                      disabled={!selectedJiraFieldId}
                      style={{
                        padding: "0 1rem",
                        background: selectedJiraFieldId
                          ? "var(--accent-primary)"
                          : "rgba(255,255,255,0.05)",
                        border: "none",
                        borderRadius: "8px",
                        color: selectedJiraFieldId
                          ? "var(--background-dark)"
                          : "var(--text-secondary)",
                        cursor: selectedJiraFieldId ? "pointer" : "not-allowed",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        transition: "all 0.2s",
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Option B: Manual Add */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    background: "rgba(255,255,255,0.01)",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      fontWeight: "600",
                    }}
                  >
                    Or add custom field manually:
                  </span>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.5rem",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Field ID (e.g. customfield_10010)"
                      value={manualFieldId}
                      onChange={(e) => setManualFieldId(e.target.value)}
                      style={{
                        background: "var(--background-dark)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        color: "var(--text-primary)",
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.8rem",
                        outline: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Field Name (e.g. Story Points)"
                      value={manualFieldName}
                      onChange={(e) => setManualFieldName(e.target.value)}
                      style={{
                        background: "var(--background-dark)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        color: "var(--text-primary)",
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.8rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <button
                    onClick={handleAddManualCustomField}
                    disabled={!manualFieldId.trim() || !manualFieldName.trim()}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      background:
                        manualFieldId.trim() && manualFieldName.trim()
                          ? "rgba(102, 252, 241, 0.1)"
                          : "rgba(255,255,255,0.02)",
                      border:
                        manualFieldId.trim() && manualFieldName.trim()
                          ? "1px solid var(--accent-primary)"
                          : "1px solid var(--border-color)",
                      borderRadius: "6px",
                      color:
                        manualFieldId.trim() && manualFieldName.trim()
                          ? "var(--accent-primary)"
                          : "var(--text-secondary)",
                      cursor:
                        manualFieldId.trim() && manualFieldName.trim()
                          ? "pointer"
                          : "not-allowed",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                  >
                    Add Custom Field
                  </button>
                </div>
              </div>
            </div>

            {/* Footer / Reset */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(0,0,0,0.1)",
              }}
            >
              <button
                onClick={resetColumnsToDefault}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ff6b6b",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: "500",
                  textDecoration: "underline",
                }}
              >
                Reset to Default
              </button>
              <button
                onClick={() => setIsConfigOpen(false)}
                style={{
                  padding: "0.5rem 1.5rem",
                  background: "var(--accent-primary)",
                  border: "none",
                  borderRadius: "8px",
                  color: "var(--background-dark)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  boxShadow: "0 0 10px rgba(102, 252, 241, 0.2)",
                  transition: "transform 0.1s",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.97)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                Done
              </button>
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
