const http = require('http');

const url = "http://darkorbit-22-client.bpsecure.com/bpflashclient/windows.x64/repository/Updates.xml";

const httpGet = url => {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            res.setEncoding('utf8');
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
};

async function getVersion() {
    let xml = await httpGet(url);
    let version = xml.match(/>(.*)<\/Version/)[1];

    return `BigPointClient/${version}`;
}

module.exports = getVersion;