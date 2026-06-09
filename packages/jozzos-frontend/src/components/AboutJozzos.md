#### What is Jozzos?

Jozzos is a supplemental UI for issue management tools such as Jira. It is designed to help with managing large projects that have dozens of issues, each of which might have a deeply nested tree of blockers from which timelines must be calculated.

It incorporates a lot of the ideas from https://y.tsutsumi.io/multi-org-project-planning/.

#### Why should I use it?

Standard trackers often hide blocker hierarchies or make it difficult to visualize deep dependency chains. Jozzos solves this by providing:

- Infinite Blocker Recursion: Automatically traverses and maps nested blockers to any depth.
- Interactive Spreadsheets: Edit issue fields (Summary, Status, Assignee, Reporter) inline by double-clicking.
- Visual Dependency Tree: Instantly see which issues block which, nested with collapsible rows.

#### How do I use it?

1. **Connect to Jira**: Go to the **Settings** page and add your Jira domain, email, and API key.
2. **Search Issues**: On the **Issues** page, enter a Jira Filter ID or raw JQL string (e.g. `project = TEST`) in the query input.
3. **Inspect Blockers**: Look for red lock icons or expand collapsible blocker tree rows to explore recursive blocker hierarchies.
4. **Edit Inline**: Double-click any editable cell (Summary, Status, Assignee, Reporter) to make changes and save them instantly to Jira.
