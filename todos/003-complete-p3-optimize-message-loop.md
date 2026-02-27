---
status: complete
priority: p3
issue_id: "003"
tags: [performance, code-review]
dependencies: []
---

# Optimize registeredGroups iteration in startMessageLoop

## Problem Statement

In `src/index.ts`, `startMessageLoop` runs every `POLL_INTERVAL` (frequently). Inside this loop, it executes `Object.entries(registeredGroups).map(([key, group]) => ...)` to construct an array of `chatPairs` for database polling. If the application scales to thousands of registered groups, this O(N) object allocation on every tick could cause unnecessary memory churn and impact performance.

## Findings

- `src/index.ts`: The `startMessageLoop` iterates over the entire `registeredGroups` object every tick to extract JIDs and channels.
- While functionally correct, it creates new objects unnecessarily.

## Proposed Solutions

### Option 1: Memoize Chat Pairs Array

**Approach:** Maintain a separate array of `chatPairs` that is only updated when `registerGroup` is called or when groups are removed.

**Pros:**
- Eliminates O(N) allocation in the hot loop.
- Simple to implement.

**Cons:**
- Slight increase in state management complexity.

**Effort:** < 30 minutes

**Risk:** Low

---

### Option 2: Refactor DB Query to Not Require Pre-mapped Array

**Approach:** If `getNewMessages` only needs to know *that* there are registered groups, we might be able to restructure the DB query to only fetch messages that have a matching record in the `registered_groups` table, instead of passing the entire list as an `IN (...)` clause.

**Pros:**
- Offloads the filtering to SQLite, which is highly optimized.
- Solves potential SQLite limit on the number of bind parameters (`IN` clause limits).

**Cons:**
- Requires writing a JOIN query in `src/db.ts`.

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action
Implement Option 1: Memoize the `chatPairs` array in `src/index.ts` and update it only when registered groups change, avoiding repeated O(N) allocations in the poll loop.

## Technical Details

**Affected files:**
- `src/index.ts`
- `src/db.ts`

## Resources

- **PR:** #1

## Acceptance Criteria

- [ ] `startMessageLoop` does not iterate over all `registeredGroups` just to extract IDs every tick.
- [ ] The `getNewMessages` logic correctly limits results to registered groups without degrading performance.

## Work Log

### 2026-02-27 - Initial Discovery

**By:** Claude Code

**Actions:**
- Identified potential performance bottleneck in `startMessageLoop` during code review.
- Created pending todo.

**Learnings:**
- Hot loops should avoid unnecessary object creation and O(N) operations.

---

### 2026-02-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**
- User opted for Option 1 (Memoization) as a simple and effective performance win.
