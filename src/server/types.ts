export interface SqlResult {
  rows?: Record<string, unknown>[];
  changes?: number;
  lastID?: number;
  error?: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  tool_choice?: string;
}

export interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
}

export interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  history: string;
}

export interface TableSchema {
  sql: string;
}

export interface TableName {
  name: string;
}
