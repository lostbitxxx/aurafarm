# Aurafarm frontend design specification
## Source of truth
Existing repository and backend/native companion contracts determine tracking, XP, persistence, purchases and authorization.
Reference HTML is visual inspiration, not production session logic.
## Visual tokens
Page #F6F2E6; modal #FFF9ED; primary text #23392D; secondary #596650; lime #C5EF47; borders #C5CBB9; XP accent #B4A0D1.
Warm cream dialogs with dark text. Ensure WCAG AA text contrast; test selected, unselected, hover, focus and disabled states.
## Header
Shop, Inventory and Achievements open centered dialogs without leaving dashboard.
Preserve direct routes. Reuse real Shop and Inventory content.
Achievements: Coming soon! No fabricated rewards.
Daily streak: show “Streak coming soon” with no number until records can reliably mark full completions. Do not fabricate a streak or use localStorage.
No scores or shop points.
## Website room
Cozy pixel-art room with chosen owned pets. Inventory still lists all owned pets.
Room placement is in-memory only for this frontend phase; it resets on reload. No localStorage. Document backend persistence for later.
Inventory provides Show in room / Remove from room, independent of Equip.
Duplicate pets are independent instances, with unique IDs and progress.
Level label stays above each pet. Equipped pet has a visible badge and subtle highlight.
Bounded walking area, pauses, no pets wandering through solid furniture. Empty room has a friendly Inventory action.
Petting requires left-right pointer movement over pet; pause wandering briefly on interaction.
Click/keyboard activation opens pet details. Provide a Pet button for touch/keyboard.
## Pet details
Enlarged pet, blurred background, real name/level/XP and threshold.
Color, Hat and Clothes remain visible but disabled with “Coming soon” until ownership exists. No free unlocks or schema changes.
Equip pet action is blocked while a study session is active so the session pet_id / XP recipient stays unchanged.
No database/catalog renaming to fit sample artwork.
Temporary visual mapping only: baby_slime → cat; lantern_moth → bunny; river_newt → differently colored cat. Keep mapping centralized.
## Session setup
Preserve two steps: length then tracker.
Length: 5/30/60/90/Custom. Numeric input only after Custom.
Custom accepts whole minutes 1-240; reject empty/fractional/out-of-range values.
Cancel on first step; Back on second. Confirmation starts session.
Tracker: Desktop pet or Website timer.
Close blocked tabs appears only when Desktop pet selected.
Keep real download action, launch code/link/start time for Desktop pet.
Desktop hides website countdown. Website uses current website timer.
Do not restore inline duration choices below room; Start opens existing two-step flow.
## Personalization
Gear+chevron toggle, accessible labels, aria-expanded, clear hit area.
Retain relevant current Dev/download controls and authorization.
Sessions and Experience open history dialogs. Remove duplicate Inventory entry.
Keep existing responsive website EXP-bar placement.
## Native desktop bar
Document-only for now. See native-bar-lobby-backlog.md.
Do not claim the Electron companion implements the design-kit bar/lobby until break timing and XP rules are confirmed.
## XP
Existing rate 2 XP/minute, full completion 1.1 multiplier, distraction 0.7 multiplier.
Do not decide multiplier composition, rounding or partial-minute rules in frontend.
Ending early saves actual studied time through existing action.
## Backend boundaries
No schema migrations, monitoring rewrites, currency reintroduction or admin changes without approval.
/admin resets only signed-in account; frontend redesign must not change this.
Missing room-placement/accessory/streak persistence must be reported, not silently replaced with localStorage.
## Asset bundle
aurafarm-pet-assets.json maps relative SVG paths to SVG strings.
Production frontend uses cat and bunny artwork only (no slime). Four colors; forest hat; blue vest.
States: idle, walk1, walk2, blush, wait, study1, study2.
Idle/walk/blush/wait use 42x42 grid; study frames use 64x64 grid with tiny desk/book.
Animation pairs have matching viewBoxes within each state group. CSS image-rendering: pixelated; SVG shape-rendering: crispEdges.
Treat species as visual types, not ownership IDs. Room SVG is 600x300.
Use only approved existing catalog mappings. Missing artwork has a clear fallback.
## Accessibility/performance
Focus trap, Escape/backdrop close, focus restoration, dialog title and scroll locking.
Reduced motion support, touch/keyboard fallback, stable pet IDs.
Avoid frame-rate React state updates. Clean animation timers/listeners on unmount; pause offscreen.
Test responsive layouts with panel expanded/collapsed and dialogs open.
