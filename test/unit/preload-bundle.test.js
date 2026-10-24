const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const esbuild = require("esbuild");
const { ROOT } = require("../helpers/mocks");

// The DarkOrbit windows are sandboxed: their preload can only require "electron" at runtime.
// Build it the same way `npm run build:preload` does and make sure nothing else slipped in.
describe("inject/preload.js bundle", () => {
    let bundle;

    it("builds for a sandboxed renderer (browser platform, Chromium 87)", async () => {
        let result = await esbuild.build({
            entryPoints: [path.join(ROOT, "inject", "preload.js")],
            bundle: true,
            platform: "browser",
            format: "cjs",
            target: "chrome87",
            external: ["electron"],
            write: false,
            logLevel: "silent"
        });
        bundle = result.outputFiles[0].text;
        assert.ok(bundle.length > 0);
    });

    it("only requires electron at runtime", () => {
        let required = [...new Set([...bundle.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(match => match[1]))];
        assert.deepEqual(required, ["electron"]);
    });

    it("contains no Node-only APIs", () => {
        for (let api of ["child_process", "process.resourcesPath", "fs.readFileSync", "WebSocketServer"]) {
            assert.equal(bundle.includes(api), false, api);
        }
    });
});
