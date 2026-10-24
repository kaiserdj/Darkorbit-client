const https = require('https');
const settings = require("electron-settings");

const url = "https://darkorbit-22-client.bpsecure.com/bpflashclient/windows.x64/repository/Updates.xml";
const fallbackVersion = "1.6.9";
const timeout = 5000;

const httpsGet = url => {
    return new Promise((resolve, reject) => {
        let request = https.get(url, { timeout }, res => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Unexpected status ${res.statusCode}`));
            }

            res.setEncoding('utf8');
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        });

        request.on('timeout', () => request.destroy(new Error("Timeout")));
        request.on('error', reject);
    });
};

async function fetchVersion() {
    let match = (await httpsGet(url)).match(/<Version>([0-9.]+)<\/Version>/);
    if (!match) {
        throw new Error("Version not found");
    }
    return match[1];
}

function storeVersion(version) {
    let backup = settings.getSync();
    if (backup.clientVersion !== version) {
        backup.clientVersion = version;
        settings.setSync(backup);
    }
    return version;
}

// The version from the last run is used right away and refreshed in the background,
// so only the very first start waits for the network.
async function getVersion() {
    let refresh = fetchVersion().then(storeVersion);
    let cached = settings.getSync().clientVersion;
    let version;

    if (cached) {
        refresh.catch(error => console.error(`Could not refresh the client version: ${error.message}`));
        version = cached;
    } else {
        try {
            version = await refresh;
        } catch (error) {
            console.error(`Could not read the client version, using ${fallbackVersion}: ${error.message}`);
            version = fallbackVersion;
        }
    }

    return `BigPointClient/${version}`;
}

module.exports = getVersion;
