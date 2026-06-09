import React from "react";

export const AboutJozzosContent: React.FC = () => {
  return (
    <>
      <div>
        <h4
          style={{
            margin: "0 0 0.5rem 0",
            color: "var(--text-primary)",
            fontSize: "1rem",
          }}
        >
          What is Jozzos?
        </h4>
        <p style={{ margin: 0 }}>
          Jozzos is a high-productivity user interface for issue trackers (like
          Jira) designed specifically for superusers and program managers. It
          turns complex task lists into an interactive, spreadsheet-like
          workspace, highlighting blockers and dependencies in real-time.
        </p>
      </div>

      <div>
        <h4
          style={{
            margin: "0 0 0.5rem 0",
            color: "var(--text-primary)",
            fontSize: "1rem",
          }}
        >
          Why should I use it?
        </h4>
        <p style={{ margin: "0 0 0.5rem 0" }}>
          Standard trackers often hide blocker hierarchies or make it difficult
          to visualize deep dependency chains. Jozzos solves this by providing:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: "1.2rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <li>
            <strong>Infinite Blocker Recursion</strong>: Automatically traverses
            and maps nested blockers to any depth.
          </li>
          <li>
            <strong>Interactive Spreadsheets</strong>: Edit issue fields
            (Summary, Status, Assignee, Reporter) inline by double-clicking.
          </li>
          <li>
            <strong>Visual Dependency Tree</strong>: Instantly see which issues
            block which, nested with collapsible rows.
          </li>
        </ul>
      </div>

      <div>
        <h4
          style={{
            margin: "0 0 0.5rem 0",
            color: "var(--text-primary)",
            fontSize: "1rem",
          }}
        >
          How do I use it?
        </h4>
        <ol
          style={{
            margin: 0,
            paddingLeft: "1.2rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <li>
            <strong>Connect to Jira</strong>: Go to the{" "}
            <strong>Settings</strong> page and add your Jira domain, email, and
            API key.
          </li>
          <li>
            <strong>Search Issues</strong>: On the <strong>Issues</strong> page,
            enter a Jira Filter ID or raw JQL string (e.g.{" "}
            <code>project = TEST</code>) in the query input.
          </li>
          <li>
            <strong>Inspect Blockers</strong>: Look for red lock icons or expand
            collapsible blocker tree rows to explore recursive blocker
            hierarchies.
          </li>
          <li>
            <strong>Edit Inline</strong>: Double-click any editable cell
            (Summary, Status, Assignee, Reporter) to make changes and save them
            instantly to Jira.
          </li>
        </ol>
      </div>
    </>
  );
};
