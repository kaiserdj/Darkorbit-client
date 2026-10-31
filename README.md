<h1 align="center">DarkOrbit Client</h1> 

<p align="center">
  <a href="http://forthebadge.com/" target="_blank">
    <img src="http://forthebadge.com/images/badges/built-with-love.svg"/>
  </a>
  <a href="https://discord.gg/vHqAaxS7xF" target="_blank">
    <img src="https://img.shields.io/discord/819695791072608296.svg?label=Discord&logo=Discord&colorB=7289da&style=for-the-badge" height="35">
  </a>
</p>

Open source client for cross-platform Darkorbit (Windows, Mac and Linux).

This is a security hardened fork of [kaiserdj/Darkorbit-client](https://github.com/kaiserdj/Darkorbit-client). Version 3.0.0 fixes vulnerabilities of 2.8.0 and earlier that let web pages run code on the computer and let saved passwords be decrypted without the master password; see [SECURITY.md](SECURITY.md).
<p align="center">
  <a href="https://github.com/emrementese/darkorbit-client-secure/blob/main/LICENSE" target="_blank">
    <img src="https://img.shields.io/badge/License-AGPLv3-blue.svg"/>
  </a>
  <a href="https://github.com/emrementese/darkorbit-client-secure/actions/workflows/ci.yml">
    <img src="https://github.com/emrementese/darkorbit-client-secure/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
</p>

## Features

|                                                                       |     |
| --------------------------------------------------------------------- | --- |
| Free code 100% modifiable                                             | ✔   |
| Multi platform                                                        | ✔   |
| Multi account                                                         | ✔   |
| Flash player injected (0 configuration)                               | ✔   |
| Custom loading Dosid (by GUI or by launch parameters)                 | ✔   |
| AutoLogin (by GUI or by launch parameters)                            | ✔   |
| Custom load - DarkDev (Modify request)                                | ✔   |
| Custom js - DarkDev                                                   | ✔   |
| Custom css - DarkDev                                                  | ✔   |
| Resource download - DarkDev                                           | ✔   |
| [Plugin Darkbot](https://github.com/kaiserdj/Plugin-Launcher-Darkbot) | ✔   |


Download
-------
🔽 The latest release is always available here: https://github.com/emrementese/darkorbit-client-secure/releases/latest
 
## Development
Building Darkorbit client is really simple

### Dependencies

* Be sure that Npm is installed. You can find how to install npm (node) [here](https://nodejs.org/en/).

Clone this project

```bash
> git clone https://github.com/emrementese/darkorbit-client-secure.git
> cd darkorbit-client-secure
```

Install the dependencies:

```bash
> npm install
```

On Apple Silicon Macs the bundled Flash plugin only runs in the x64 build of Electron (through Rosetta). `npm install` switches Electron to x64 automatically on macOS; if Flash does not load, run:

```bash
> npm run electron:x64
```

Flash only runs in Electron 11, so `electron` is pinned to 11.5.0 and GitHub reports the Electron advisories against it. See [SECURITY.md](SECURITY.md#known-limitations) for why and how they are handled.

### Usage
##### Start app

```bash
> npm start
```

##### Start app in mode development

```bash
> npm dev
```

The DarkOrbit windows run in a sandboxed renderer, so their preload is bundled into
`inject/dist/preload.js` by `npm run build:preload`. `npm install`, `npm start`, `npm run dev` and the
build scripts run it automatically; the preload may only `require("electron")` at runtime
(Node work such as the packet logger and `--api` lives in the main process).

##### Tests

```bash
> npm run lint       # ESLint
> npm test           # unit tests (Electron is mocked, runs anywhere)
> npm run test:e2e   # end-to-end tests on the real client (opens windows, needs a display)
```

Unit tests and lint run in CI on every push; builds and releases only start when they pass.

### Releasing

Bump `version` in `package.json` (for example `npm version 3.1.0 --no-git-tag-version`) and push it to `main`. The [Release workflow](.github/workflows/release.yml) tests, builds macOS, Windows and Linux into a draft release and publishes it when every platform succeeded. It can also be started from the Actions tab.

## Contributing

For bugs, questions, and discussions please use the [Github Issues](https://github.com/emrementese/darkorbit-client-secure/issues). Please report security issues privately as described in [SECURITY.md](SECURITY.md).

Pull requests are welcome! If you see something you'd like to add, please do. For drastic changes, please open an issue first.

## Donating

You can support the original author of this project through the link below

[![Support via PayPal](https://cdn.rawgit.com/twolfson/paypal-github-button/1.0.0/dist/button.svg)](https://www.paypal.me/kaiserdj/)

## Contributors ✨

Thanks go to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="20%"><a href="http://kaiserdj.github.io"><img src="https://avatars2.githubusercontent.com/u/5487950?v=4?s=100" width="100px;" alt="Kaiserdj"/><br /><sub><b>Kaiserdj</b></sub></a><br /><a href="https://github.com/kaiserdj/Darkorbit-client/commits?author=kaiserdj" title="Code">💻</a> <a href="https://github.com/kaiserdj/Darkorbit-client/commits?author=kaiserdj" title="Tests">⚠️</a> <a href="#projectManagement-kaiserdj" title="Project Management">📆</a> <a href="#tool-kaiserdj" title="Tools">🔧</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/ODAKAB"><img src="https://avatars.githubusercontent.com/u/49538323?v=4?s=100" width="100px;" alt="odakab"/><br /><sub><b>odakab</b></sub></a><br /><a href="#financial-odakab" title="Financial">💵</a> <a href="#ideas-odakab" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/QR4SH3D"><img src="https://avatars.githubusercontent.com/u/69433658?v=4?s=100" width="100px;" alt="OneManArmy"/><br /><sub><b>OneManArmy</b></sub></a><br /><a href="#financial-QR4SH3D" title="Financial">💵</a> <a href="#ideas-QR4SH3D" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/HeizerGe5"><img src="https://avatars.githubusercontent.com/u/71152480?v=4?s=100" width="100px;" alt="HeizerGe5"/><br /><sub><b>HeizerGe5</b></sub></a><br /><a href="#financial-HeizerGe5" title="Financial">💵</a> <a href="#ideas-HeizerGe5" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/SenttX1"><img src="https://avatars.githubusercontent.com/u/86185939?v=4?s=100" width="100px;" alt="SenttX1"/><br /><sub><b>SenttX1</b></sub></a><br /><a href="#financial-SenttX1" title="Financial">💵</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="20%"><a href="https://github.com/EMREREKILLERRZ"><img src="https://avatars.githubusercontent.com/u/90413379?v=4?s=100" width="100px;" alt="EMREREKILLERRZ"/><br /><sub><b>EMREREKILLERRZ</b></sub></a><br /><a href="#financial-EMREREKILLERRZ" title="Financial">💵</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/bogdandudu"><img src="https://avatars.githubusercontent.com/u/20356046?v=4?s=100" width="100px;" alt="bogdandudu"/><br /><sub><b>bogdandudu</b></sub></a><br /><a href="https://github.com/kaiserdj/Darkorbit-client/issues?q=author%3Abogdandudu" title="Bug reports">🐛</a> <a href="https://github.com/kaiserdj/Darkorbit-client/commits?author=bogdandudu" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/Frenvius"><img src="https://avatars.githubusercontent.com/u/5433348?v=4?s=100" width="100px;" alt="Felipe Ribeiro"/><br /><sub><b>Felipe Ribeiro</b></sub></a><br /><a href="https://github.com/kaiserdj/Darkorbit-client/issues?q=author%3AFrenvius" title="Bug reports">🐛</a> <a href="https://github.com/kaiserdj/Darkorbit-client/commits?author=Frenvius" title="Code">💻</a></td>
      <td align="center" valign="top" width="20%"><a href="https://github.com/emrementese"><img src="https://avatars.githubusercontent.com/u/76906642?v=4?s=100" width="100px;" alt="Emre MENTEŞE"/><br /><sub><b>Emre MENTEŞE</b></sub></a><br /><a href="https://github.com/emrementese/darkorbit-client-secure/commits?author=emrementese" title="Code">💻</a> <a href="#security-emrementese" title="Security">🛡️</a> <a href="https://github.com/emrementese/darkorbit-client-secure/commits?author=emrementese" title="Tests">⚠️</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## Story

My initial intention with this project was to create a client for darkorbit that could be used by any user with any operating system (Windows, mac or linux), and had better performance.

When I already had a stable version, I tried to contact darkorbit to give them the client and if they wanted, implement it, modify it, or whatever they wanted ..... but after many attempts:
- Twitter: I never received a reply
- Official darkorbit forum: They delete my posts, saying that I can't publish external links. After talking on discord with an admin, he told me the steps I should follow to publish a post correctly, without a link, as a suggestion, etc.
- Discord: They treated me as if I was trying to steal data or as if I was a hack
- etc...

I abandon the idea of ​​contacting Darkorbit.

From now on I will continue to develop utilities for the client, not only as a client to play, but also to develop. With the intention of learning more about electron, js and in general to practice programming, while having fun with it.

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Bigpoint or any of its subsidiaries or its affiliates. The official Bigpoint website can be found at https://www.bigpoint.net. "Bigpoint" as well as related names, marks, emblems and images are registered trademarks of their respective owners.

## License

Copyright © Kaiserdj

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE.md](LICENSE.md) file for details.
