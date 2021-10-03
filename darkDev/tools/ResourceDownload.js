const fs = require("fs");
const path = require("path");
const crypto = require('crypto')
const xml2js = require("xml2js");

class ResourceDownload {
    constructor(window, opt) {
        this.window = window;
        this.opt = opt;
        this.domain = this.opt.customServer ? `https://${this.opt.server}.darkorbit.com` : "https://darkorbit-22.bpsecure.com";
        this.listFiles = { files: [] };

        this.console(`Defined settings: ${JSON.stringify(this.opt)}`);

        this.console(`Selected domain: ${this.domain}`);

        this.run();
    }

    async run() {
        await this.XmlColections();

        for (let elem of this.opt.listExtraFiles) {
            let file = {
                location: elem.split("/").pop(),
                path: elem
            }

            await this.downloader(file);
        }

        fs.writeFileSync(path.join(this.opt.folder, "listFiles.json").normalize(), this.listFiles);

        this.console(" ");
        this.console("Work done :D");
    }

    async XmlColections() {
        for (let xml of this.opt.listXmlColections) {
            let file = {
                location: xml.split("/").pop(),
                path: xml
            };

            await this.downloader(file);

            await this.readFileColection(xml);
        }

        fs.writeFileSync(path.join(this.opt.folder, "listFiles.json"), JSON.stringify(this.listFiles, null, 2), 'utf-8');
    }

    async readFileColection(xml) {
        let dataXml = await fs.readFileSync(path.join(this.opt.folder, xml)).toString();
        dataXml = await xml2js.parseStringPromise(dataXml);
        dataXml = dataXml.filecollection;

        let locations = [];

        if (dataXml.location) {
            for (let elem of dataXml.location) {
                locations.push(elem.$);
            }
        }

        for (let file of dataXml.file) {
            file = file.$;

            if (locations.length === 0) {
                let directorys = xml.split("/");
                file.location = directorys.slice(0, directorys.length - 1).join("/") + "/" + file.location + "/";
            } else {
                file.location = locations.filter(function(obj) {
                    return obj.id === file.location;
                })[0].path;

                file.location = `spacemap/${file.location}`;
            }

            file.path = `${file.location}${file.name}.${file.type}`;

            await this.downloader(file);

            if (this.opt.checkHash && file.hash) {
                let resultMd5 = await this.md5(path.join(this.opt.folder, file.path).normalize());
                if (file.hash.substring(0, file.hash.length - 2) === resultMd5.substring(0, resultMd5.length - 2)) {
                    this.console("Hash check: Passed");
                } else {
                    this.console("Hash check: Error");
                }
            }
        }
    }

    async downloader(file) {
        let pathfile = path.join(this.opt.folder, file.path).normalize();

        this.window.webContents.downloadURL(`${this.domain}/${file.path}`);

        return new Promise((resolve, reject) => {
            this.window.webContents.session.once('will-download', (event, item, webContents) => {
                if (!fs.existsSync(file.location)) {
                    fs.mkdirSync(file.location, { recursive: true });
                }

                item.setSavePath(pathfile);

                this.console(`Downloading: ${file.path}`);

                item.on('updated', (event, state) => {
                    if (state === 'interrupted') {
                        this.console(`Download failed: ${state}`);
                        return reject(state);
                    }
                })
                item.once('done', (event, state) => {
                    if (state === 'completed') {
                        this.listFiles.files.push(file);
                        this.console("Download completed");
                        return resolve(true);
                    } else {
                        this.console(`Download failed: ${state}`);
                        return reject(state);
                    }
                })
            })
        })
    }

    console(text) {
        this.window.webContents.send("consoleDownload", text);
    }

    md5(path) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('md5');
            const rs = fs.createReadStream(path);
            rs.on('error', reject);
            rs.on('data', chunk => hash.update(chunk));
            rs.on('end', () => resolve(hash.digest('hex')));
        })
    }
}

module.exports = ResourceDownload;