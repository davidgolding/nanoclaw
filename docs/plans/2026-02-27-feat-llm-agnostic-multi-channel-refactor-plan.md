---
title: LLM-Agnostic and Multi-Channel Refactor
type: feat
status: completed
date: 2026-02-27
origin: docs/brainstorms/2026-02-27-llm-agnostic-multi-channel-refactor-brainstorm.md
---

# LLM-Agnostic and Multi-Channel Refactor

## Overview
This plan outlines the architectural refactor of Nanoclaw to support multiple LLM providers (Claude, OpenAI, Gemini) and multiple communication channels (WhatsApp, Telegram, Discord, Signal, etc.). It decouples the core message loop from specific SDKs and services.

## Problem Statement / Motivation
Currently, Nanoclaw is tightly coupled with Anthropic's Claude SDK and the WhatsApp `baileys` library. This limits its reach to users of other messaging platforms and prevents it from leveraging other powerful LLMs.

## Proposed Solution
1. **Host-side:** Implement a `ChannelManager` to dynamically load and manage various `Channel` implementations. Standardize the `Channel` interface and update the database to include `channel_type` metadata.
2. **Container-side:** Refactor the `agent-runner` to use an `AgentProvider` interface. Implement adapters for different LLMs that map their native tool-calling (function calling) to a set of shared common tools.

## Technical Considerations
- **Shared Common Tools:** We will implement tools like `Bash`, `Read`, and `Write` as standalone functions in the container. Adapters will translate LLM-specific tool calls into these functions.
- **Dynamic Configuration:** Channel tokens and model types will be loaded from modular config files in `config/channels/` and `.env`.
- **JID Scoping:** JIDs will remain raw in the database, but all queries will be scoped by the `channel_type` column to prevent cross-channel collisions.

## System-Wide Impact

### Interaction Graph
- **Message Inbound:** `Channel.onMessage` -> `storeMessage` -> `startMessageLoop` -> `processGroupMessages` -> `runContainerAgent`.
- **Agent Output:** `AgentProvider.streamResult` -> `writeOutput` -> `Host.onOutput` -> `Channel.sendMessage`.

### Error & Failure Propagation
- Channel-specific connection errors will trigger individual retry logic.
- LLM provider errors (rate limits, auth) will be bubbled up as `ContainerOutput` errors and reported to the user through the originating channel.

### State Lifecycle Risks
- Switching models for a group will result in a fresh session ID being stored in the database, as sessions are not portable between providers.

## Acceptance Criteria

### Functional Requirements
- [ ] Support for Telegram via `telegraf`.
- [ ] Support for Discord via `discord.js`.
- [ ] Support for Signal via `signal-cli` JSON-RPC.
- [ ] Support for OpenAI models (GPT-4.1+) with tool calling.
- [ ] Support for Gemini models (Gemini 2.0+) with function calling.
- [ ] `/setup` command handles multi-channel configuration flows.

### Non-Functional Requirements
- [ ] Tool execution latency should not increase significantly compared to the current Claude-native implementation.
- [ ] Channel implementations must support reconnection and message queuing.

## Implementation Phases

### Phase 1: Host Infrastructure
1.  **DB Migration:** Add `channel_type` to `chats` and `messages` tables.
2.  **`Channel` Interface Update:** Add `setup()` and `channelType` properties.
3.  **`ChannelManager`:** Implement dynamic loading of channels from `config/channels/`.
4.  **Refactor `index.ts`:** Replace hardcoded `whatsapp` with `ChannelManager`.

### Phase 2: Container Refactor
1.  **`AgentProvider` Interface:** Define standard methods for streaming queries and handling tool calls.
2.  **Shared Tools:** Extract current tool logic into standalone modules.
3.  **Adapters:** Implement `ClaudeAdapter`, `OpenAIAdapter`, and `GeminiAdapter`.
4.  **`agent-runner/index.ts`:** Update to load the appropriate adapter based on `ContainerInput`.

### Phase 3: New Channels
1.  **Telegram:** Implement `TelegramChannel` using `telegraf`.
2.  **Discord:** Implement `DiscordChannel` using `discord.js`.
3.  **Signal:** Implement `SignalChannel` using `signal-cli`.

## Sources & References
- **Origin brainstorm:** [docs/brainstorms/2026-02-27-llm-agnostic-multi-channel-refactor-brainstorm.md](docs/brainstorms/2026-02-27-llm-agnostic-multi-channel-refactor-brainstorm.md). Carried forward: Multi-SDK Provider architecture, Modular config files, Raw JID with metadata.
- **OpenAI Node.js SDK:** [https://developers.openai.com/api/reference/typescript](https://developers.openai.com/api/reference/typescript)
- **Google Generative AI SDK:** [https://ai.google.dev/api/generate-content](https://ai.google.dev/api/generate-content)
- **Telegraf Documentation:** [https://telegraf.js.org/](https://telegraf.js.org/)
- **Discord.js Guide:** [https://discordjs.guide/](https://discordjs.guide/)
- **Signal-cli JSON-RPC:** [https://github.com/AsamK/signal-cli/wiki/JSON-RPC-service](https://github.com/AsamK/signal-cli/wiki/JSON-RPC-service)
