const fs = require("fs");
const path = require("path");
const { dialog } = require("electron");
const { parseUrl } = require("../../security");

function isValidId(id) {
    return /^\d+$/.test(String(id));
}

function hasItem(list, id) {
    return isValidId(id) && Object.prototype.hasOwnProperty.call(list, String(id));
}

function isHttpsUrl(url) {
    let parsed = parseUrl(url);
    return parsed !== null && parsed.protocol === "https:";
}

function isLocalFile(file) {
    try {
        return path.isAbsolute(file) && fs.statSync(file).isFile();
    } catch (e) {
        return false;
    }
}

// Builds a clean list item from renderer data; only https sources or an existing local file are accepted.
function sanitizeItem(data, allowLocalFile) {
    if (!data || !isValidId(data.id) || typeof data.match !== "string" || data.match === "") {
        return reject("A match pattern is required.");
    }

    let item = {
        id: Number(data.id),
        enable: Boolean(data.enable),
        match: data.match,
        actionUrl: String(data.actionUrl || "")
    };

    if (allowLocalFile) {
        item.LocalFileEnable = Boolean(data.LocalFileEnable);
        item.LocalFile = "";
    }

    if (item.LocalFileEnable) {
        let file = String(data.LocalFile || "");
        if (!isLocalFile(file)) {
            return reject("The local file does not exist.");
        }
        item.LocalFile = file;
        item.actionUrl = "";
    } else if (!isHttpsUrl(item.actionUrl)) {
        return reject("Only https urls can be used as source.");
    }

    return item;
}

function reject(message) {
    dialog.showErrorBox("DarkDev", message);
    return null;
}

module.exports = {
    hasItem,
    sanitizeItem
};
