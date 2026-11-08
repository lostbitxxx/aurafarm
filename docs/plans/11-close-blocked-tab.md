# Phase 11 — Close the front blocked tab

Status: the desk has a Close blocked tabs toggle, off by default. During a claimed session, a signed-in pet reads that flag. When it is on, the front Safari, Chrome, or Edge tab is closed after 8 seconds on a blocklist host. A chat bubble above the slime says which host is closing. The visit still counts.

Depends on: the study panel from [phase 2](02-dashboard-study-controls.md) and the frontmost reader from [phase 7](07-browser-extension.md).

## Goal

The farmer chooses whether a blocklist page in front closes. The pet waits 8 seconds on that same host, then closes the active tab of the front window. The window closes only when that tab was the last one. Sibling tabs stay.

## Out of scope

A browser extension, closing background tabs, closing the whole window while other tabs are open, animating the browser window, and a packaged release. `npm start` in `desktop/` is enough to try it on a Mac.

## Touch

- `profiles.close_blocked` and `claim_study_session`, which returns the flag
- The Study section on the desk
- `desktop/frontmost.js` for the 8 second wait
- `desktop/front-browser.js` for the close statement
- A small bubble window above the sprite

## Done when

- The desk toggle is off until the farmer turns it on, and a missing column asks for migration 0007.
- With the toggle on and a claimed session, Instagram in front counts immediately and that tab closes once 8 seconds have passed. Leaving earlier, the desk, or a lookalike host does not close anything.
- A failed close does not retry until the front host changes, and the pet says the browser asked to confirm.
- The bubble shows `Closing` plus the host while the close is underway, and hides when the host changes or the close fails.
- No file under `extension/` is added.
