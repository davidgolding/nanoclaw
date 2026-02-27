import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentProvider, ContainerInput, ContainerOutput } from '../types.js';
import { sharedTools } from '../tools/definitions.js';
import path from 'path';
import fs from 'fs';

export class ClaudeAdapter implements AgentProvider {
  name = 'claude';
  private input!: ContainerInput;
  private sdkEnv!: Record<string, string | undefined>;

  async initialize(input: ContainerInput, sdkEnv: Record<string, string | undefined>): Promise<void> {
    this.input = input;
    this.sdkEnv = sdkEnv;
  }

  async query(
    prompt: string | AsyncIterable<any>,
    onOutput: (output: ContainerOutput) => Promise<void>
  ): Promise<{ newSessionId?: string; lastAssistantUuid?: string; closedDuringQuery: boolean }> {
    
    let newSessionId: string | undefined;
    let lastAssistantUuid: string | undefined;
    let messageCount = 0;
    let resultCount = 0;
    let closedDuringQuery = false;

    // Mapping our shared tools to the SDK format if needed, 
    // although Claude Code SDK handles many of these natively or via its own MCP.
    // For this refactor, we'll let Claude use its native tools + our nanoclaw MCP.
    
    const mcpServerPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../ipc-mcp-stdio.js');

    for await (const message of query({
      prompt: prompt as any,
      options: {
        cwd: '/workspace/group',
        resume: this.input.sessionId,
        model: this.input.modelVersion,
        env: this.sdkEnv,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        mcpServers: {
          nanoclaw: {
            command: 'node',
            args: [mcpServerPath],
            env: {
              NANOCLAW_CHAT_JID: this.input.chatJid,
              NANOCLAW_GROUP_FOLDER: this.input.groupFolder,
              NANOCLAW_IS_MAIN: this.input.isMain ? '1' : '0',
            },
          },
        },
      }
    })) {
      messageCount++;
      
      if (message.type === 'assistant' && 'uuid' in message) {
        lastAssistantUuid = (message as { uuid: string }).uuid;
      }

      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
      }

      if (message.type === 'result') {
        resultCount++;
        const textResult = 'result' in message ? (message as { result?: string }).result : null;
        await onOutput({
          status: 'success',
          result: textResult || null,
          newSessionId
        });
      }
    }

    return { newSessionId, lastAssistantUuid, closedDuringQuery };
  }
}
