/** Shared TypeScript boundaries for data crossing HTTP, provider and extension APIs. */
export type JsonRecord = Record<string, any>;

export interface AdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: string;
  content?: any;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  [key: string]: any;
}

export interface ToolCall {
  id?: string;
  type?: string;
  index?: number;
  function?: {
    name?: string;
    description?: string;
    arguments?: string;
    parameters?: JsonRecord;
  };
  [key: string]: any;
}

export interface ChatRequestOptions extends JsonRecord {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop_sequences?: string[];
  tools?: ToolCall[];
  tool_choice?: any;
  stream_options?: JsonRecord;
}

export interface ExtensionSource {
  kind?: string;
  scope?: string;
  imported?: boolean;
  pluginId?: string;
  pluginPackage?: JsonRecord;
  [key: string]: any;
}

export interface McpServerRecord extends JsonRecord {
  id?: string;
  name?: string;
  description?: string;
  transport?: string;
  enabled?: boolean;
  trustLevel?: string;
  allowPrivate?: boolean;
  targets?: string[];
  source?: ExtensionSource;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  bearerTokenEnvVar?: string;
  updatedAt?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface JsonStore {
  read<T>(name: string, fallback: T): T;
  write(name: string, value: unknown): void;
  remove(name: string): void;
  resolve(name: string): string;
  mutate<T>(name: string, update: (current: T) => T | undefined | Promise<T | undefined>, fallback: T): Promise<T | undefined>;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  defaultProjectId: string;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  defaultAgentId?: string | null;
  defaultProviderId?: string | null;
  defaultModel?: string | null;
}

export interface AssetRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  source: 'url' | 'local';
  url: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}
