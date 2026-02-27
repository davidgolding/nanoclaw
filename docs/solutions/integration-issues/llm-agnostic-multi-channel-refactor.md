---
module: core
problem_type: integration_issue
component: architecture
severity: high
symptoms:
  - Tight coupling with Anthropic Claude SDK and Baileys WhatsApp library.
  - Hardcoded logic preventing support for other LLMs (OpenAI, Gemini).
  - Inability to add messaging channels like Telegram, Discord, or Signal.
  - Primary key collisions in database if JIDs overlap across different services.
root_cause: |
  Initial architecture was built as a single-purpose bot for Claude and WhatsApp. 
  The message loop and agent runner directly invoked specific SDKs, and the data model 
  did not account for the 'channel' as a differentiating dimension for user/group identifiers.
tags: [refactor, multi-channel, llm-agnostic, typescript, architecture]
---

# LLM-Agnostic and Multi-Channel Refactor

## Problem Statement
The system was originally designed exclusively for Claude (via Anthropic SDK) and WhatsApp (via Baileys library). This created significant technical debt and limited the bot's extensibility to other LLM providers and communication platforms.

## Findings
- `src/index.ts` was hardcoded to instantiate `WhatsAppChannel`.
- `container/agent-runner/src/index.ts` directly used `@anthropic-ai/claude-agent-sdk`.
- Database primary keys for `chats` and `messages` relied solely on `jid`, which is not unique across different messaging services (e.g., Telegram and Signal use numeric strings that could collide).
- Lack of validation for external configuration files.

## Working Solution

### 1. Host Infrastructure: Channel Abstraction
Introduced a `ChannelManager` to dynamically load enabled channels from `config/channels/*.json`.

```typescript
// src/types.ts
export interface Channel {
  name: string;
  type: string;
  connect(): Promise<void>;
  sendMessage(jid: string, text: string): Promise<void>;
  isConnected(): boolean;
  ownsJid(jid: string): boolean;
  disconnect(): Promise<void>;
  setup?(): Promise<void>;
  syncGroupMetadata?(force?: boolean): Promise<void>;
}
```

### 2. Container Refactor: Provider Pattern
Refactored the agent runner to use an `AgentProvider` interface with specific adapters.

```typescript
// container/agent-runner/src/types.ts
export interface AgentProvider {
  name: string;
  initialize(input: ContainerInput, sdkEnv: Record<string, string | undefined>): Promise<void>;
  query(
    prompt: string | AsyncIterable<any>,
    onOutput: (output: ContainerOutput) => Promise<void>
  ): Promise<{ newSessionId?: string; lastAssistantUuid?: string; closedDuringQuery: boolean }>;
}
```

Implemented `ClaudeAdapter` and `OpenAIAdapter` to handle LLM-specific logic and tool calling.

### 3. Data Model Update
Updated the database schema to include `channel` in primary keys to prevent JID collisions.

```sql
PRIMARY KEY (jid, channel)
```

## Prevention Strategist Guidance
- **Interface-Driven Design**: Always define interfaces for external integrations (LLMs, Channels) to avoid vendor lock-in.
- **System Boundaries Validation**: Use `zod` to validate all external inputs, including modular configuration files.
- **Composite Identity**: When dealing with multi-platform identifiers, always include the platform/channel as part of the unique identity.

## Related PRs
- **PR:** #1 - Feature: LLM-Agnostic and Multi-Channel Refactor

## Acceptance Criteria Verified
- [x] All 352 tests pass.
- [x] Multi-channel JID scoping verified in `src/db.test.ts` and `src/ipc-auth.test.ts`.
- [x] Dynamic channel loading verified via `ChannelManager`.
- [x] OpenAI and Claude adapter parity confirmed.
