## Design

### Platform Agnostic

Although this will be built for Jira initially, I want to make it agnostic to the issue management tracker. This will let me re-use this at any company I work at.

### local UI with API keys

Instead of a UI built into the actual cloud service, I would like to be able to render and use the UI locally instead. This enables a significant amount of control in the front-end framework and experience.

An API key can be fed into the application to authenticate, list issues, etc.

### Navigation & Layout

- **Hamburger Navigation**: A hamburger menu provides access to different pages within the app, keeping the main interface clean.
- **Hidden Configuration**: API configuration and settings are placed on a separate dedicated page (e.g. `/settings`).
- **Main View**: The primary view focuses entirely on the issue table and query inputs. A history of previous queries is maintained (up to 1000 items) to allow quick access to frequent searches.
- **Sparse Spreadsheet View**: Search results are rendered in a dense, spreadsheet-like view that minimizes vertical space and focuses on critical details (e.g., ID, Key, Summary, Status) to accommodate high-volume issue triage.
- **Inline Editing**: Double-clicking on a mutable cell in the table (Summary, Status, Assignee, Reporter) opens an inline contextual editor. Saving triggers real-time updates directly to the Jira server:
  - **Summary**: Direct text input updates the issue fields.
  - **Status**: Fetches current available transitions from the Jira workflow and displays them in a sleek dropdown select.
  - **Assignee / Reporter**: Accepts a text query, searches for matching Jira users, and assigns the correct `accountId` or unassigns them if cleared.
