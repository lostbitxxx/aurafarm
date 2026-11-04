# Phase 7 — Browser extension

Status: not started.

Depends on: [phase 6](06-download-pairing-wakeup.md). The pet must already be able to claim a session and know the blocklist.

## Goal

A Chrome Manifest V3 extension the user loads themselves. While the pet says a session is active, the extension closes tabs whose hostname matches the blocklist and tells the pet. With no active session it does not read tabs for blocking and does not close anything.

## Out of scope

Chrome Web Store submission, native messaging, reading page contents, and storing a browsing history. Phase 9 covers the store and native messaging.

## Touch

- `extension/manifest.json`
- `extension/background.js`
- `extension/host-match.js` — same matching rules as [`lib/blocklist.ts`](../../lib/blocklist.ts)
- `extension/README.md` is not required; the load-unpacked steps belong in this plan's "Done when" and in the root README only if the implementation needs a user-facing install note. Put the install steps at the bottom of this file when they are known (chrome://extensions, Developer mode, Load unpacked, select `extension/`).
- Pet script that listens on `127.0.0.1:47331` after a successful claim, and stops listening when the session ends or the process quits
- `tests/blocklist.test.ts` already covers the TypeScript matcher. Add `tests/extension-host-match.test.ts` that imports `extension/host-match.js` and checks the same cases, so the two copies cannot drift in silence. A comment in both files points at the other.

## Extension permissions

`manifest.json` permissions: `tabs` only. That is enough to read a tab URL and call `chrome.tabs.remove`. Do not request `<all_urls>` or `webRequest`.

`host_permissions` stay empty. The extension connects outward to `ws://127.0.0.1:47331`.

## Socket

The pet listens on `127.0.0.1:47331` only after claim, and accepts one extension connection. It sends:

```json
{ "type": "session", "active": true, "blocklist": ["instagram.com", "tiktok.com", "youtube.com"] }
```

On session end:

```json
{ "type": "session", "active": false }
```

The extension sends, after it closes a tab:

```json
{ "type": "blocked", "host": "www.instagram.com" }
```

The pet increments its blocked count and remembers the host. It ignores hosts that fail the same matcher against the session blocklist.

If the socket is down, or `active` is false, the extension does not close tabs. Closing the pet fails closed.

The pet does not need to trust an arbitrary local page. It can require the websocket `Origin` to start with `chrome-extension://`. Document that any local process can still open the port. Phase 9 replaces the port with native messaging. Do not bind `0.0.0.0`.

## Tab rule

On `chrome.tabs.onUpdated`, when a session is active and the tab status is `complete` or the URL is already known:

- Parse the hostname.
- If it matches the blocklist, remove that tab, then send `blocked`.
- Do not remove a tab whose hostname is the Aurafarm desk origin. The pet includes `desk_origin` in the session message so the extension can ignore it.
- Match `instagram.com` and `www.instagram.com`. Do not match `notinstagram.com`.

Debounce one close per tab id so `onUpdated` does not fire a second event into a tab that is already closing.

## Done when

- `npm test` imports `extension/host-match.js` and agrees with `lib/blocklist.ts` for `www.instagram.com`, `instagram.com`, and `notinstagram.com`.
- Load the extension unpacked. With the pet claimed and the socket up, opening `https://www.instagram.com` closes that tab, and the pet's blocked count becomes 1.
- Quit the pet, or end the session, and open Instagram again. The tab stays open.
- The Aurafarm dashboard tab stays open while a session is active.
