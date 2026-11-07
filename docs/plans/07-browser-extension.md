# Phase 7 — Frontmost site

Status: not started. There is no browser extension, and this phase does not add one.

Depends on: the Electron pet from [phase 5](05-roaming-desktop-pet.md) and a claimed session from [phase 6](06-download-pairing-wakeup.md). The pet must already have the blocklist from the claim response.

## Goal

While a claimed study session is active, the Electron pet reads the address bar of the frontmost browser window and keeps the hostname. A hostname that matches the session blocklist increments `blocked_count` and is stored in `blocked_hosts`. Background tabs are unread. The pet does not close a tab.

With no active session, the pet does not read the address bar.

## Out of scope

A Chrome extension, `extension/`, `chrome.tabs`, native messaging, and any listener on `127.0.0.1`. Closing a tab is not part of this phase. Reading page contents, passwords, or browsing history is not part of this phase.

## Touch

- `desktop/` — the address-bar poll, started after claim and stopped when the session ends or the process quits
- `lib/blocklist.ts` — the pet uses the same host rules the server already has

Do not add `extension/manifest.json`, `extension/background.js`, or `extension/host-match.js`.

## What the pet reads

Windows is the first target. The window title is the page title, so the pet does not match on it. The pet takes the foreground window, checks that the process is a supported browser, and reads that window's address-bar control. It keeps the hostname.

Supported browsers for the first version are Chrome, Edge, and Firefox. A browser the reader does not know contributes no host.

The Aurafarm desk host is ignored. `www.instagram.com` matches `instagram.com`. `notinstagram.com` does not. The first blocklist is `instagram.com`, `tiktok.com`, and `youtube.com`, including subdomains.

The pet polls on a short timer only while the claimed session is active. One visible visit counts once until the frontmost host changes away and comes back.

## Done when

- With a claimed session, focusing `https://www.instagram.com` in Chrome makes the pet's blocked count 1 and records that host.
- Focusing the Aurafarm desk does not increment the count.
- Quitting the pet, or ending the session, and then focusing Instagram again leaves the count unchanged.
- A background Instagram tab does not increment the count.
- No file under `extension/` is added, and the pet opens no port.
