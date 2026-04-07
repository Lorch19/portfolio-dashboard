# Story 8.3: Debug Tab — Agent Logs and Error Traces

**Status:** done

As Omri,
I want to view agent logs with filtering and see error stack traces,
So that I can diagnose pipeline issues without SSH access.

## Acceptance Criteria

**AC1:** Debug > Logs sub-tab shows log entries with: timestamp, agent, severity (INFO/WARNING/ERROR), message text.

**AC2:** Filter by agent (dropdown), date (picker), severity (dropdown) via search params.

**AC3:** ERROR entries expand to show full stack trace in monospace code block.

**AC4:** Mobile: severity indicated by color badges, stack traces scrollable.

## Tasks

1. Build Logs sub-tab section in `frontend/src/routes/debug.tsx`
