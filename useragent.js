const https = require('https');

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

async function getVersion() {
    let version = fallbackVersion;

    try {
        let match = (await httpsGet(url)).match(/<Version>([0-9.]+)<\/Version>/);
        if (match) {
            version = match[1];
        }
    } catch (error) {
        console.error(`Could not read the client version, using ${fallbackVersion}: ${error.message}`);
    }

    return `BigPointClient/${version}`;
}

module.exports = getVersion;
