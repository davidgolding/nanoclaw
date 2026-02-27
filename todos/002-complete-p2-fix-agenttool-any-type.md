---
status: complete
priority: p2
issue_id: "002"
tags: [typescript, type-safety, refactor, code-review]
dependencies: []
---

# Fix 'any' type in AgentTool.execute arguments

## Problem Statement

The `AgentTool` interface in `container/agent-runner/src/types.ts` defines the `execute` method as `execute: (args: any) => Promise<any>;`. This circumvents TypeScript's type checking for tool arguments and return types.

## Findings

- `container/agent-runner/src/types.ts`: `AgentTool.execute` uses `any`.
- `container/agent-runner/src/tools/definitions.ts`: Tool implementations like `scheduleTask` type their `args` parameter as `any`.
- This violates the strict TypeScript convention of avoiding `any`.

## Proposed Solutions

### Option 1: Generic Type Parameters

**Approach:** Update `AgentTool` to accept a generic type parameter for arguments and return types, e.g., `interface AgentTool<TArgs = any, TReturn = any>`.

**Pros:**
- Provides strict type safety.
- Allows each tool definition to strongly type its execution function.

**Cons:**
- Slightly more verbose tool definitions.

**Effort:** < 1 hour

**Risk:** Low

---

### Option 2: Use 'unknown'

**Approach:** Replace `any` with `unknown` and require each tool to validate or cast its arguments internally (e.g., using Zod schemas).

**Pros:**
- Better than `any`.
- Forces runtime validation.

**Cons:**
- Requires more boilerplate inside each `execute` block.

**Effort:** < 1 hour

**Risk:** Low

## Recommended Action
Update `AgentTool` to use generic type parameters for arguments and return types to provide better type safety for tool execution.

## Technical Details

**Affected files:**
- `container/agent-runner/src/types.ts`
- `container/agent-runner/src/tools/definitions.ts`

## Resources

- **PR:** #1

## Acceptance Criteria

- [ ] `AgentTool.execute` signature uses generics instead of `any`.
- [ ] All shared tool implementations in `definitions.ts` are strongly typed.
- [ ] `tsc` passes without errors.

## Work Log

### 2026-02-27 - Initial Discovery

**By:** Claude Code

**Actions:**
- Identified `any` usage in the new `AgentTool` interface during PR review.
- Created pending todo.

**Learnings:**
- Defining dynamic tools often leads to falling back to `any`; using `unknown` or generics is a safer pattern.

---

### 2026-02-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**
- User opted for Option 1 (Generic Type Parameters) to ensure strict typing across tool definitions.
