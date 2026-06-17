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
  customFields?: Record<string, unknown>;
  isRecursiveBlocker?: boolean;
}

export interface IssueTrackerConfig {
  apiToken: string;
  userEmail?: string;
  jiraDomain: string;
  useProxy?: boolean;
}
