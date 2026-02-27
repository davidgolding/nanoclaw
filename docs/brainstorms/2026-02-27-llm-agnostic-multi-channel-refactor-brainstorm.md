---
date: 2026-02-27
topic: llm-agnostic-multi-channel-refactor
---

# LLM-Agnostic and Multi-Channel Refactor

## What We're Building
A comprehensive refactor of Nanoclaw to decouple the core logic from specific LLM providers (currently Claude-only) and communication channels (currently WhatsApp-only). The goal is a modular system where any LLM can be used as the "brain" and any messaging service as the "interface."

## Why This Approach
The current system is tightly coupled with the Anthropic Claude Agent SDK and the Baileys WhatsApp library. To support other LLMs (OpenAI, Gemini) and channels (Telegram, Discord, Signal, etc.), we need a provider-based architecture.

### Key Decisions

#### 1. LLM-Agnostic Architecture (Container-side)
- **Multi-SDK Provider:** We will implement an `AgentProvider` interface in the container's agent-runner. Specific adapters (e.g., `ClaudeAdapter`, `OpenAIAdapter`, `GeminiAdapter`) will implement this interface.
- **Shared Common Tools:** A shared set of tools (Read, Write, Bash, etc.) will be implemented independently of LLM SDKs. Each adapter will map its native tool-calling mechanism to these shared tools.
- **Dynamic Adapter Loading:** The host will pass the `modelType` and associated API keys to the container in the `ContainerInput`.

#### 2. Multi-Channel Support (Host-side)
- **Modular Config Files:** Channel configurations (credentials, tokens) will be stored in `config/channels/*.json` (e.g., `telegram.json`, `discord.json`).
- **Channel Manager:** A new `ChannelManager` class in `src/index.ts` will load these configurations and instantiate the enabled channels dynamically.
- **Raw JID with Metadata:** We will store raw user/group identifiers (JIDs) in the database and include a `channel_type` field in the metadata for every message and session to distinguish between services.

#### 3. Standardized Messaging Protocol
- We will continue to use the current XML-based message formatting (`<messages><message>...</message></messages>`) for prompts to the agent, as it is a proven pattern for structured context.
- We will standardize the `Channel` interface to ensure consistency across all supported services.

## Open Questions
- **Signal & iMessage Implementation:** These services often require specific bridges or local gateways (e.g., `signal-cli`, `bluebubbles-bridge`). How will we manage these dependencies in the host environment?
- **Tool-Call Parity:** How do we ensure that tools like `Bash` or `Edit` behave identically across different LLMs with varying levels of tool-calling capability?
- **Session Migration:** Can sessions be migrated between different LLM providers, or are they provider-specific?

## Next Steps
→ `/workflows:plan` for implementation details.
