# Story 6.3: Decisions Tab — Counterfactual Analysis

## Status: done

## Story

As Omri, I want to see counterfactual analysis showing top missed opportunities and validated good rejections, with per-gate accuracy metrics, so I can evaluate the quality of the rejection pipeline.

## Acceptance Criteria

- AC1: "Top Misses" section showing rejected tickers where T+20 forward return > 10%
- AC2: "Good Rejections" section showing rejected tickers where T+20 forward return < 0%
- AC3: Per-gate accuracy metrics cards (total rejections, miss rate %, validate rate %)
- AC4: Each counterfactual entry shows ticker, date, gate, reason, T+20 return
- AC5: Mobile responsive with vertically stacked layout

## Implementation

### Files Modified
- `frontend/src/routes/decisions.tsx` — CounterfactualSection, CounterfactualTable, gate accuracy cards
- `frontend/src/routes/decisions.test.tsx` — Tests for counterfactual rendering, gate metrics, error states

### Architecture Notes
- CounterfactualSection computes gate accuracy from combined misses + good rejections
- Gate stats: total rejections, miss rate %, validate rate % per gate
- Two side-by-side tables (desktop) or stacked (mobile) for top misses vs good rejections
- Color coding: misses in destructive (red), good rejections in success (green)
- Desktop table + mobile card responsive layout (same pattern as decisions table)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Completion Notes
- Implemented alongside Story 6.2 in the same decisions page
- Gate accuracy metrics computed client-side from counterfactual data
- All tests passing

### Change Log
- 2026-04-07: Story 6.3 implementation complete
