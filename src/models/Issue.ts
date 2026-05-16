export interface Issue {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee?: string;
  reporter?: string;
  url: string;
}

export interface IssueTrackerConfig {
  apiToken: string;
  userEmail?: string;
  useProxy?: boolean;
}
