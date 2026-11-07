# Phase 9 — Packaging

Status: not started.

Depends on: [phase 6](06-download-pairing-wakeup.md), [phase 7](07-browser-extension.md), and [phase 8](08-pet-scoring-action.md).

## Goal

A person can download a signed Mac Electron build, read what the pet is allowed to see, and update the pet when a new version is published. Windows packaging waits.

## Out of scope

macOS notarization, a Linux package, a Chrome extension, and native messaging. The pet does not listen on a local port.

## Touch

- `app/api/pet/version/route.ts` — public `GET` returning `{ "version": "0.1.0", "download_url": "<NEXT_PUBLIC_PET_DOWNLOAD_URL>" }`
- `app/privacy/page.tsx` — plain page linked from the desk
- Electron startup check against `/api/pet/version`
- Root [`README.md`](../../README.md) — download and `aurafarm://` registration for the Electron app

## Signing and the file the desk serves

Publish the Electron Mac build as a zip at `NEXT_PUBLIC_PET_DOWNLOAD_URL`. The Next.js app does not contain the binary. `electron-builder` output stays under `desktop/dist/` and is gitignored.

Document the signing step in `desktop/SIGNING.md` only if a certificate is actually in use. Until then, this plan is the instruction:

- Sign and notarize the Mac app before uploading the release. Windows Authenticode waits with the Windows build.
- An unsigned Mac build is blocked by Gatekeeper. The desk copy should say to right-click the app and choose Open for an unsigned build, and that sentence comes off the page once the signed URL is the one in the env var.
- Do not commit the certificate or its password. The signing machine reads them from the environment.

The Electron app registers `aurafarm://` for the current user. That registration replaces `desktop/install-protocol.reg`, which the phase 5 deletion commit removes.

## Updates

On startup the pet GETs `/api/pet/version`. If `version` is newer than the constant baked into that build, the pet shows an update line and opens `download_url` when the user asks. It does not replace its own files while running.

The route reads the same env var as the download button. No auth.

## Privacy page

State all of the following in normal language:

- During a study session the user started, the pet reads the address bar of the frontmost browser window.
- It does not read background tabs, page contents, or passwords.
- It does not close tabs.
- The server stores the score, the duration, the blocked count, and the blocked hostnames for that session.
- The pet heartbeats so the desk can show that it is running. The heartbeat is a timestamp, not a list of tabs.
- Stopping the session or quitting the pet stops the address-bar check.

## Done when

- `GET /api/pet/version` returns the configured download URL and a version string.
- The pet shows an update line when that version is newer than its own.
- `/privacy` is linked from the desk and matches the behavior of phases 6 through 8.
- Either the signed download is the URL on the desk, or the desk still shows the unsigned-build SmartScreen instruction.
- The download is an Electron build, and the repo still has no `extension/` directory.
