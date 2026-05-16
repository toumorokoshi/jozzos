# Jozzos

Jozzos is a premium UI for issue management systems, designed for superusers who want to manage a large project across multiple different dimensions.

## Features

- **Platform Agnostic Architecture**: Core services are designed to decouple the specific tracker from the UI models.
- **Local Priority**: Render and run the UI locally, granting full control of the frontend framework.
- **Premium Aesthetics**: Built with glassmorphism, dynamic animations, and dark-mode optimization.
- **Jira Integration**: Natively interfaces with Jira out-of-the-box using the `/rest/api/3/search` endpoint.

## Getting Started

### Prerequisites

- Node.js
- A Jira Cloud instance with Basic Auth (Email + API Key), or a Jira instance that supports Bearer Tokens.

### Environment Setup

Create a `.env` file in the root of the directory to configure the default local Vite proxy. The proxy avoids CORS issues with the Jira REST API. You can also configure the Jira Domain directly in the application's Settings page.

```env
JIRA_HOSTNAME="your-domain.atlassian.net"
```

### Running Locally

Install the dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Visit `http://localhost:5173` and input your Jira API credentials and Filter ID/JQL string to fetch and view issues.

## Testing & Tooling

We employ standard tools for maintainability:

- **Formatting**: `just format`
- **Linting**: `just lint`
- **Tests**: `npx vitest run` (Test files must end in `_test.ts` as per the design guidelines).

## Issue Tracking

We use `bd` (beads) for issue management. See `AGENTS.md` for more information on how we manage tasks.
