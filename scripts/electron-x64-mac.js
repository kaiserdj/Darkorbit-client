// The bundled Pepper Flash plugin for macOS only exists for x86_64, so on Apple Silicon the
// client has to run the x64 build of Electron through Rosetta. npm installs the arm64 build
// by default; this script swaps it for the x64 build. It does nothing on other platforms or
// when the x64 build is already installed.
//
// Usage: node scripts/electron-x64-mac.js [--force]

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const electronDir = path.dirname(require.resolve("electron/package.json"));
const binary = path.join(electronDir, "dist", "Electron.app", "Contents", "MacOS", "Electron");

const MACHO_64 = 0xfeedfacf;
const FAT = 0xcafebabe;
const CPU_TYPE_X86_64 = 0x01000007;

function installedArch() {
    let fd;
    try {
        fd = fs.openSync(binary, "r");
    } catch (e) {
        return null;
    }

    try {
        let header = Buffer.alloc(8);
        fs.readSync(fd, header, 0, 8, 0);

        if (header.readUInt32BE(0) === FAT) {
            return "universal";
        }
        if (header.readUInt32LE(0) === MACHO_64) {
            return header.readUInt32LE(4) === CPU_TYPE_X86_64 ? "x64" : "arm64";
        }
        return "unknown";
    } finally {
        fs.closeSync(fd);
    }
}

function main() {
    if (process.platform !== "darwin") {
        return;
    }

    let arch = installedArch();
    let force = process.argv.includes("--force");

    if (!force && (arch === "x64" || arch === "universal")) {
        console.log(`Electron is already ${arch}, Pepper Flash can load.`);
        return;
    }

    console.log(`Installing the x64 build of Electron (found: ${arch || "none"}) so Pepper Flash can load through Rosetta...`);

    // electron/install.js skips the download while dist/ and path.txt exist.
    fs.rmSync(path.join(electronDir, "dist"), { recursive: true, force: true });
    fs.rmSync(path.join(electronDir, "path.txt"), { force: true });

    let result = spawnSync(process.execPath, [path.join(electronDir, "install.js")], {
        cwd: electronDir,
        stdio: "inherit",
        env: Object.assign({}, process.env, { npm_config_arch: "x64" })
    });

    if (result.status !== 0 || installedArch() !== "x64") {
        console.error("Could not install the x64 build of Electron.");
        process.exit(1);
    }

    if (spawnSync("arch", ["-x86_64", "/usr/bin/true"]).status !== 0) {
        console.warn("Rosetta is not installed. Install it with: softwareupdate --install-rosetta --agree-to-license");
    }

    console.log("Electron x64 installed.");
}

main();
