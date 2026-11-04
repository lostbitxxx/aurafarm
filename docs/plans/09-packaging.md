# Phase 9 — Packaging

Status: not started.

Depends on: [phase 6](06-download-pairing-wakeup.md), [phase 7](07-browser-extension.md), and [phase 8](08-pet-scoring-action.md).

## Goal

A person can download a signed Windows build, see what the extension is allowed to do, and update the pet when a new version is published. Native messaging can replace the loopback port once the unpacked extension flow already works.

## Out of scope

macOS notarization, a Linux package, and an automatic Chrome Web Store upload. Store submission is a checklist at the end of this phase, done by a person in the Chrome Web Store dashboard.

## Touch

- `app/api/pet/version/route.ts` — public `GET` returning `{ "version": "0.1.0", "download_url": "<NEXT_PUBLIC_PET_DOWNLOAD_URL>" }`
- `app/privacy/page.tsx` — plain page linked from the desk and from the extension listing text
- Pet startup check against `/api/pet/version`
- `desktop/native-host/com.aurafarm.pet.json` — Chrome native messaging host manifest, optional path
- `extension/manifest.json` — add `nativeMessaging` only if that path is switched on
- Root [`README.md`](../../README.md) — download, protocol registration, and unpacked extension steps that the earlier phases left in their plans

## Signing and the file the desk serves

Publish the Windows export as a zip or installer at `NEXT_PUBLIC_PET_DOWNLOAD_URL`. The Next.js app does not contain the binary.

Document the signing step in `desktop/SIGNING.md` only if a certificate is actually in use. Until then, this plan is the instruction:

- Authenticode-sign the exe with the project's certificate before uploading the release.
- An unsigned build still fails SmartScreen on a new download. The desk copy should say to use "More info" then "Run anyway" for an unsigned build, and that sentence comes off the page once the signed URL is the one in the env var.
- Do not commit the certificate or its password. The signing machine reads them from the environment.

`install-protocol.reg` from phase 6 stays the protocol registration for a zip layout. An installer can write the same keys and the native-host key below.

## Updates

On startup the pet GETs `/api/pet/version`. If `version` is newer than the constant baked into that export, the pet shows an update line and `OS.shell_open`s `download_url` when the user asks. It does not replace its own exe while running.

The route reads the same env var as the download button. No auth.

## Privacy page

State all of the following in normal language:

- The extension looks at tab hostnames only while a study session the user started is active.
- It closes tabs that match the blocklist and sends those hostnames to the local pet.
- It does not read page contents, passwords, or tabs outside an active session.
- The server stores the score, the duration, the blocked count, and the blocked hostnames for that session.
- The pet heartbeats so the desk can show that it is running. The heartbeat is a timestamp, not a list of tabs.
- Stopping the session, quitting the pet, or removing the extension stops the checks.

## Native messaging

Do this after the loopback session in phase 7 has been seen working.

- Add a native host named `com.aurafarm.pet` whose path is the installed exe.
- `allowed_origins` is the unpacked extension's id during development, and the store id once it exists. Keep the id in `extension/HOST_ID.txt` or in the manifest the installer copies. Do not guess a store id in git.
- The installer writes the host manifest path under the Chrome `NativeMessagingHosts` registry key for the current user.
- The pet speaks the native-messaging length-prefixed JSON frames on stdin/stdout when launched with `--native-host`, and keeps the WebSocket path when launched normally, until the extension build that uses `chrome.runtime.connectNative` is the one being tested.
- When that extension build is the default, stop listening on `47331`.

The message shapes stay the ones in phase 7 (`session` and `blocked`).

## Store checklist

Submit only after the privacy page is live.

- Single purpose: close the user's chosen blocklist during a session they started.
- Permission justification for `tabs`: read the tab hostname and close a matching tab.
- Host the privacy policy URL.
- A short demo video of a session closing an Instagram tab and returning a lower score.

## Done when

- `GET /api/pet/version` returns the configured download URL and a version string.
- The pet shows an update line when that version is newer than its own.
- `/privacy` is linked from the desk and matches the behavior of phases 6 through 8.
- Either the signed download is the URL on the desk, or the desk still shows the unsigned-build SmartScreen instruction.
- If native messaging is included in the same change, the extension closes an Instagram tab with nothing listening on `47331`.
