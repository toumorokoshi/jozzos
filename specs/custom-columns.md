# Specification: Custom Columns and Reordering

This specification describes the addition of custom column selection and column reordering to the main spreadsheet view of Jozzos.

## Requirements

1. **Custom Columns**: Users must be able to select from any standard or custom fields available in their Jira instance.
2. **Reordering**: Users must be able to change the order of columns in the list view.
3. **Persistence**: Column choices and order must be stored in `localStorage` and persist between page refreshes and sessions.
4. **Jira Field Discovery**: The application must query the Jira Cloud `/rest/api/3/field` API to discover available fields and their names.
5. **Robust Dynamic Rendering**: The table columns (including header, content, and expanded blocker rows) must adapt automatically to the active columns and their configured order.

## Architecture & API Design

### 1. Jira Client Additions (`JiraClient.ts`)

We will add a new client method `getJiraFields` to query Jira's available fields:

```typescript
export interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  navigable: boolean;
  searchable: boolean;
}

export const getJiraFields = async (
  config: IssueTrackerConfig,
): Promise<JiraField[]> => {
  // Queries GET /rest/api/3/field
};
```

We will also update `getIssuesByFilter` to accept an optional array of `extraFields` to construct the JQL search parameters dynamically:

```typescript
export const getIssuesByFilter = async (
  config: IssueTrackerConfig,
  filterIdOrJql: string,
  extraFields?: string[],
): Promise<Issue[]> => {
  // Construct dynamic fields list: ['summary', 'status', 'assignee', 'reporter', 'issuelinks', 'description', 'priority', 'created', 'updated', ...extraFields]
  // Parse any extra fields and return them as a property `customFields` on each issue.
};
```

### 2. Issue Model Updates (`Issue.ts`)

We will update the `Issue` interface to support dynamic custom fields:

```diff
 export interface Issue {
   id: string;
   key: string;
   summary: string;
   status: string;
   assignee?: string;
   reporter?: string;
   url: string;
   blockingIssues?: Issue[];
   blockedBy?: Issue[];
   blocks?: Issue[];
   description?: unknown;
   priority?: string;
   created?: string;
   updated?: string;
+  customFields?: Record<string, any>;
 }
```

### 3. User Preferences Persistence

Column preferences are stored in `localStorage` as a JSON array of `ColumnConfig` objects:

```typescript
interface ColumnConfig {
  id: string;
  name: string;
}
```

- Key: `jozzos_active_columns`
- Default Active Columns: Key, Summary, Status, Assignee, Reporter.

### 4. Dynamic Column Configuration UI

We will implement a premium slide-out side panel (flyout drawer) from the right:

- Built with an overlay panel and smooth transitions.
- Displays:
  - **Active Columns**: Vertical list with "Move Up", "Move Down", and "Remove" (X) buttons.
  - **Available Columns**: List of fields returned by Jira (filtered by a search input, excluding fields already active). Clicking "+" adds them to active.
- **Controls**: "Reset to Defaults" to restore the standard 5 columns.

### 5. Spreadsheet Column Rendering

The spreadsheet table headers, issue rows, and expanded blocker rows will dynamically iterate through `activeColumns` to render cells in the exact order specified. Standard columns (Key, Summary, Status, Assignee, Reporter) retain their premium special behaviors (e.g., inline editing), while custom columns render via a generalized robust formatting function `formatFieldValue`.
