export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  secrets?: Record<string, string>;
  modelType?: 'claude' | 'openai' | 'gemini';
  modelVersion?: string;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

export interface AgentTool<TArgs = any, TReturn = any> {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: TArgs) => Promise<TReturn>;
}

export interface AgentProvider {
  name: string;
  initialize(input: ContainerInput, sdkEnv: Record<string, string | undefined>): Promise<void>;
  query(
    prompt: string | AsyncIterable<any>,
    onOutput: (output: ContainerOutput) => Promise<void>
  ): Promise<{ newSessionId?: string; lastAssistantUuid?: string; closedDuringQuery: boolean }>;
}
