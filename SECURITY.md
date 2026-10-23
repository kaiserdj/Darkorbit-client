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
(Chromium 87) and Flash no longer receive security updates, and on Linux the
Chromium sandbox has to be disabled for Flash. Only use the client to visit
DarkOrbit pages.
