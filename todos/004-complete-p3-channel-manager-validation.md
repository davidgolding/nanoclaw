---
status: complete
priority: p3
issue_id: "004"
tags: [architecture, resilience, code-review]
dependencies: []
---

# Improve configuration validation in ChannelManager

## Problem Statement

The `ChannelManager` in `src/channel-manager.ts` reads JSON configuration files from `config/channels/*.json` using `JSON.parse(fs.readFileSync(...))`. While there is a `try/catch` block, there is no structural validation of the parsed JSON to ensure it conforms to the `ChannelConfig` interface (e.g., that `type` is present and valid). Malformed configuration could lead to runtime errors later or silent failures.

## Findings

- `src/channel-manager.ts`: The file reading and parsing logic does not use a validation library like `zod`.
- The `switch (config.type)` block gracefully handles unknown types with a warning, but doesn't validate if `type` even exists.

## Proposed Solutions

### Option 1: Add Zod Validation Schema

**Approach:** Since `zod` is already a dependency, define a `zod` schema for `ChannelConfig` and use `schema.parse()` to validate the loaded JSON.

**Pros:**
- Guarantees the configuration shape is correct at load time.
- Provides better error messages if configuration is broken.

**Cons:**
- Minimal additional boilerplate.

**Effort:** < 30 minutes

**Risk:** Low

## Recommended Action
Define a Zod schema for `ChannelConfig` in `src/channel-manager.ts` and use it to validate each configuration file as it's loaded.

## Technical Details

**Affected files:**
- `src/channel-manager.ts`

## Resources

- **PR:** #1

## Acceptance Criteria

- [ ] `ChannelManager` uses `zod` to validate the structure of channel configuration files.
- [ ] Invalid configurations log a clear error and are skipped gracefully without crashing.

## Work Log

### 2026-02-27 - Initial Discovery

**By:** Claude Code

**Actions:**
- Noticed lack of validation for configuration files during security/architecture review.
- Created pending todo.

**Learnings:**
- Always validate inputs at the system boundary, including configuration files.

---

### 2026-02-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**
- User opted for Option 1 (Zod validation) to improve system resilience.
