## User Journeys

1. list - show all issues for a given filter. Issues link directly to the Atlassian instance.

## Using for mega-project management

Also see https://y.tsutsumi.io/multi-org-project-planning/.

Fundamentally, projects can be looked at as a single parent issue, with multiple child issues under them, in a recursive fashion. Each issue is only completed if each child issue is completed. As such, a person who is accountable for one of the projects may want to see:

1. All of the projects that I am accountable for. This can be expressed via assigning the issue to the accountable party.
2.

## Granular User Journeys

### See the dependency hierarchy

Given an issue X, the list view should include an arrow which can be expanded to show all of the issues that are blocking that parent issue.

### Adding blocker issues

Users can add blocker issues directly from the list view. In the "Actions" column of each issue row, a blocker icon button is available. Clicking this button opens a modal prompt where the user inputs the key or ID of the issue they want to set as a blocker. Upon submission, the app links the issues using a "Blocks" relationship in Jira and refreshes the list view to display the newly added dependency.
