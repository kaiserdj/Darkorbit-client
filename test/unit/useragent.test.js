const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("events");
const { installMocks, uninstallMocks, loadFresh, createSettings, waitFor } = require("../helpers/mocks");

const UPDATES_XML = "<Updates><ApplicationVersion>1.0.0</ApplicationVersion><PackageUpdate><Version>1.7.0</Version></PackageUpdate></Updates>";

// https.get double: answers with the given status/body or fails with an error.
function fakeHttps({ status = 200, body = UPDATES_XML, error = null } = {}) {
    let requests = [];
    return {
        requests,
        get(url, options, callback) {
            requests.push({ url, options });
            let request = new EventEmitter();
            request.destroy = () => {};
            setImmediate(() => {
                if (error) {
                    request.emit("error", error);
                    return;
                }
                let response = new EventEmitter();
                response.statusCode = status;
                response.setEncoding = () => {};
                response.resume = () => {};
                callback(response);
                response.emit("data", body);
                response.emit("end");
            });
            return request;
        }
    };
}

function load(https, stored = {}) {
    let settings = createSettings(stored);
    installMocks({ https, "electron-settings": settings });
    return { getVersion: loadFresh("useragent.js"), settings };
}

describe("useragent.js", () => {
    afterEach(uninstallMocks);

    it("fetches the version over https on the first start and caches it", async () => {
        let https = fakeHttps();
        let { getVersion, settings } = load(https);

        assert.equal(await getVersion(), "BigPointClient/1.7.0");
        assert.match(https.requests[0].url, /^https:\/\//);
        assert.ok(https.requests[0].options.timeout > 0);
        assert.equal(settings.data.clientVersion, "1.7.0");
    });

    it("uses the cached version right away and refreshes it in the background", async () => {
        let { getVersion, settings } = load(fakeHttps(), { clientVersion: "1.6.9" });

        assert.equal(await getVersion(), "BigPointClient/1.6.9");
        await waitFor(() => settings.data.clientVersion === "1.7.0");
    });

    for (let [name, options] of [["the network fails", { error: new Error("ENOTFOUND") }], ["the server errors", { status: 500 }], ["the version is missing", { body: "<html></html>" }]]) {
        it(`falls back to a known version when ${name}`, async () => {
            let { getVersion, settings } = load(fakeHttps(options));
            assert.equal(await getVersion(), "BigPointClient/1.6.9");
            assert.equal(settings.data.clientVersion, undefined);
        });
    }
});
