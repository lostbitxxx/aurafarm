# Native Mac bar / lobby — backlog (document only)

Status: **not implemented in this frontend redesign pass**.

The design kit shows a fixed right-edge vertical EXP bar with hover preview, a 1.2s dwell before “Enter pet lobby”, a pointer bridge across the bar/preview gap, study/wait poses for the equipped pet, and a little lobby break that does not award XP.

## Current companion

The Mac companion lives in `desktop/` as an **Electron** app with a roaming canvas sprite (`sprite.html` / `sprite.js`), a separate control panel, and session scoring via existing RPCs. It does **not** currently match the design-kit fixed bar + lobby interaction model.

## Do not implement until confirmed

- Break duration limits and whether the study countdown pauses in the lobby
- Whether distraction monitoring continues during a lobby break
- XP accrual / non-accrual rules while in lobby (lobby entry must not award or collect XP)
- How early-end confirmation from the lobby maps to `end_study_early`
- Hover/focus bridge behavior across Electron window bounds (may need a single window or `setIgnoreMouseEvents` bridge)

## Suggested later work

1. Confirm native/backend rules for break timing, pause, distraction, and XP.
2. Prototype a right-edge bar + preview in Electron without changing website session contracts.
3. Wire “End session” to the existing early-end path with confirmation.
4. Keep preview art limited to the equipped pet and approved appearance assets.

Until then, website desktop-pet sessions continue to use the existing download / launch-code / pet-finish flow only.
