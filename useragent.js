const http = require('http');
const parseString = require('xml2js').parseString;

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

function parseXml(xml) {
    return new Promise((resolve, reject) => {
        parseString(xml, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function getVersion() {
    let xml = await httpGet(url);
    let json = await parseXml(xml);

    return `BigPointClient/${json.Updates.PackageUpdate[0].Version[0]}`;
}

module.exports = {
    getVersion
}