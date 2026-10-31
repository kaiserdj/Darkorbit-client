const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { installMocks, uninstallMocks, loadFresh, createElectron, FakeWebContents } = require("../helpers/mocks");

describe("security.js", () => {
    let security;
    let electron;

    before(() => {
        electron = createElectron();
        installMocks({ electron });
        security = loadFresh("security.js");
    });

    after(uninstallMocks);

    describe("isTrustedUrl", () => {
        const trusted = [
            "https://www.darkorbit.com/",
            "https://darkorbit.com",
            "https://es1.darkorbit.com/?dosid=abc",
            "https://board-en.darkorbit.com/",
            "https://WWW.DARKORBIT.COM/",
            "https://darkorbit-22.bpsecure.com/spacemap/main.swf",
            "https://sas.bpsecure.com/Sas/Authentication/Bigpoint"
        ];

        const untrusted = [
            ["plain http", "http://www.darkorbit.com/"],
            ["look-alike subdomain", "https://x.darkorbit.evil.com/"],
            ["suffix match", "https://evildarkorbit.com/"],
            ["domain as subdomain", "https://darkorbit.com.evil.tld/"],
            ["url in fragment", "https://evil.tld/#https://www.darkorbit.com/"],
            ["url in query", "https://evil.tld/?u=https://www.darkorbit.com/"],
            ["userinfo", "https://www.darkorbit.com@evil.tld/"],
            ["file scheme", "file:///etc/passwd"],
            ["javascript scheme", "javascript:alert(1)"],
            ["custom protocol", "darkorbit-client://https://www.darkorbit.com/?sid=1"],
            ["not a url", "www.darkorbit.com"],
            ["empty", ""],
            ["undefined", undefined]
        ];

        for (let url of trusted) {
            it(`accepts ${url}`, () => assert.equal(security.isTrustedUrl(url), true));
        }

        for (let [name, url] of untrusted) {
            it(`rejects ${name}`, () => assert.equal(security.isTrustedUrl(url), false));
        }
    });

    describe("isDarkorbitUrl", () => {
        it("accepts DarkOrbit hosts", () => {
            assert.equal(security.isDarkorbitUrl("https://tr4.darkorbit.com/indexInternal.es"), true);
        });

        it("rejects bpsecure hosts", () => {
            assert.equal(security.isDarkorbitUrl("https://darkorbit-22.bpsecure.com/"), false);
        });
    });

    describe("isLoginPage", () => {
        const cases = [
            ["the start page", "https://www.darkorbit.com/", true],
            ["a server start page", "https://es1.darkorbit.com/?lang=en", true],
            ["a login error page", "https://es1.darkorbit.com/index.es?action=externalHome&loginError=94", true],
            ["the game", "https://tr4.darkorbit.com/indexInternal.es?action=internalMapRevolution", false],
            ["the forum", "https://board-en.darkorbit.com/", false],
            ["another site mentioning the start page", "https://evil.tld/#https://www.darkorbit.com/", false]
        ];

        for (let [name, url, expected] of cases) {
            it(`${expected ? "detects" : "ignores"} ${name}`, () => assert.equal(security.isLoginPage(url), expected));
        }
    });

    describe("openExternalSafe", () => {
        it("opens http and https urls in the default browser", () => {
            assert.equal(security.openExternalSafe("https://example.com/"), true);
            assert.deepEqual(electron.shell.opened, ["https://example.com/"]);
        });

        for (let url of ["file:///Applications/Calculator.app", "smb://host/share", "ms-msdt:/id", "search-ms:query=x", "javascript:alert(1)"]) {
            it(`refuses ${url.split(":")[0]} urls`, () => {
                let opened = electron.shell.opened.length;
                assert.equal(security.openExternalSafe(url), false);
                assert.equal(electron.shell.opened.length, opened);
            });
        }
    });

    describe("senderIsTrusted", () => {
        it("trusts DarkOrbit pages and local app pages", () => {
            assert.equal(security.senderIsTrusted({ sender: new FakeWebContents("https://es1.darkorbit.com/") }), true);
            assert.equal(security.senderIsTrusted({ sender: new FakeWebContents("file:///app/settings/index.html") }), true);
        });

        it("does not trust other sites", () => {
            assert.equal(security.senderIsTrusted({ sender: new FakeWebContents("https://evil.tld/") }), false);
        });
    });

    describe("isLocalWsClient", () => {
        it("accepts clients without an Origin header (packet_dumper, local tools)", () => {
            assert.equal(security.isLocalWsClient({ origin: undefined }), true);
        });

        it("accepts localhost origins", () => {
            assert.equal(security.isLocalWsClient({ origin: "http://localhost:44569" }), true);
            assert.equal(security.isLocalWsClient({ origin: "http://127.0.0.1:8080" }), true);
        });

        it("rejects web pages", () => {
            assert.equal(security.isLocalWsClient({ origin: "https://evil.tld" }), false);
            assert.equal(security.isLocalWsClient({ origin: "null" }), false);
        });
    });

    describe("matchesGlob", () => {
        it("matches wildcards against the whole url", () => {
            assert.equal(security.matchesGlob("*darkorbit*internalDock*", "https://es1.darkorbit.com/indexInternal.es?action=internalDock"), true);
            assert.equal(security.matchesGlob("https://www.darkorbit.com/*.js", "https://www.darkorbit.com/a/b.js"), true);
        });

        it("does not match a pattern found inside another url", () => {
            assert.equal(security.matchesGlob("https://www.darkorbit.com/*.js", "https://evil.com/?https://www.darkorbit.com/x.js"), false);
        });

        it("treats regex characters literally", () => {
            assert.equal(security.matchesGlob("https://a.com/x.js?v=1", "https://a.com/x.js?v=1"), true);
            assert.equal(security.matchesGlob("https://a.com/x.js", "https://a.com/xxjs"), false);
            assert.equal(security.matchesGlob("*a(b[c*", "za(b[cz"), true);
        });
    });
});
