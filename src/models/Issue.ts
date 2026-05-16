export interface Issue {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee?: string;
  reporter?: string;
  url: string;
  blockingIssues?: Issue[];
}

export interface IssueTrackerConfig {
  apiToken: string;
  userEmail?: string;
  jiraDomain: string;
  useProxy?: boolean;
}
