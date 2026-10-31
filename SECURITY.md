# Security Policy

## Supported Versions

Currently, the project versions are compatible with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :x:                |
| 2.x.x   | :x:                |
| 3.x.x   | :white_check_mark: |

Version 2.8.0 and earlier allow web pages to run code on the computer and store saved passwords
with a key built into the client. Update to 3.x and change passwords saved with an older version.

## Reporting a Vulnerability

Please do not open public issues for security problems.

Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/emrementese/darkorbit-client-secure/security/advisories/new).
Include the affected version, the steps to reproduce and the impact you observed.

You can expect a first answer within 7 days. Accepted reports are fixed in a new
release and credited in the advisory unless you prefer to stay anonymous.

## Known limitations

The client depends on Pepper Flash, which only works with Electron 11. Electron 11
(Chromium 87) and Flash no longer receive security updates. To contain them, the
DarkOrbit, shop and payment windows run in Chromium's sandboxed renderer without
Node.js on macOS and Windows; on Linux the Chromium sandbox has to be disabled for
Flash. Only use the client to visit DarkOrbit pages.

### Why Electron stays on 11

Electron 12 removed support for Pepper (PPAPI) plugins, so Flash cannot load in any
newer Electron version and there is no maintained fork that brings it back. Upgrading
Electron means replacing Flash; until a replacement runs DarkOrbit, `electron` is pinned
to 11.5.0.

The [Ruffle](https://ruffle.rs) Flash emulator was tested on 31 October 2026 (nightly
0.8.0, desktop and web builds). It shows the DarkOrbit loading screen but stops loading
before the game connects to the server, so it cannot replace Flash yet.

### Why Flash stays on 32.0.0.344

The client ships Flash 32.0.0.344 for Windows and macOS and 32.0.0.371 for Linux.
32.0.0.344 is the last Adobe build without the time bomb that stops Flash from playing
content after 12 January 2021. Later Adobe builds (up to 32.0.0.465) refuse to run, and
the 34.x builds distributed only in China are not licensed for redistribution and bundle
unwanted software. A newer Flash would not fix any of the Electron issues either.

### Dependabot alerts

GitHub reports the advisories published for Electron 12 and later against `electron`
11.5.0. They are dismissed as tolerable risk: they cannot be fixed without dropping Flash.
New advisories create new alerts, which are reviewed and dismissed the same way. What
limits their impact:

- DarkOrbit, shop and payment windows run sandboxed (except on Linux, see above) with
  context isolation and without Node.js (`client.js`).
- Client windows only navigate to `https://` DarkOrbit and Bigpoint pages; other links
  open in the system browser (`security.js`, `core.js`). Shop and payment windows may
  load other `https://` pages.
- Web pages only get the fullscreen and pointer lock permissions, and only on DarkOrbit
  and Bigpoint pages; `<webview>` and Bluetooth device selection are blocked (`core.js`).

`extract-zip` 1.7.0 (also reported, no fixed version) is only used by `npm install` to
unpack the Electron download, which `@electron/get` checks against the `SHASUMS256.txt`
published with the Electron release. It is a development dependency and is not part of the packaged client.
