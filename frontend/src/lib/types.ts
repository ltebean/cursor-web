export type ToolType =
  | "shell"
  | "file_edit"
  | "read_file"
  | "grep"
  | "list_files"
  | "search"
  | string; // allow any tool type from CLI

export interface ToolCallPart {
  type: "tool_call";
  callId: string;
  toolType: ToolType;
  status: "running" | "completed" | "error";
  // shell
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  // file_edit / read_file / grep / list_files
  path?: string;
  fileContent?: string;
  message?: string;
  diff?: string;
  linesAdded?: number;
  linesRemoved?: number;
  // read_file
  totalLines?: number;
  // grep / search
  pattern?: string;
  query?: string;
}

export interface ThinkingPart {
  type: "thinking";
  content: string;
  isComplete: boolean;
}

export interface TextPart {
  type: "text";
  content: string;
}

export type MessagePart = ThinkingPart | TextPart | ToolCallPart;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: MessagePart[];
  timestamp: string;
  isStreaming?: boolean;
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  working_dir: string;
  created_at: string;
  message_count: number;
}

export interface Model {
  id: string;
  name: string;
}

export interface BrowseEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface BrowseResult {
  current: string;
  parent: string;
  entries: BrowseEntry[];
  error?: string;
}

export type Mode = "agent" | "plan" | "ask";
