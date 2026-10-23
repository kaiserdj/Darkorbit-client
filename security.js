const DARKORBIT_DOMAINS = ["darkorbit.com"];
const TRUSTED_DOMAINS = ["darkorbit.com", "bpsecure.com"];

function parseUrl(url) {
    try {
        return new URL(url);
    } catch (e) {
        return null;
    }
}

function hostMatches(hostname, domains) {
    hostname = hostname.toLowerCase();
    return domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isHttpsHostIn(url, domains) {
    let parsed = parseUrl(url);
    return parsed !== null && parsed.protocol === "https:" && hostMatches(parsed.hostname, domains);
}

function isTrustedUrl(url) {
    return isHttpsHostIn(url, TRUSTED_DOMAINS);
}

function isDarkorbitUrl(url) {
    return isHttpsHostIn(url, DARKORBIT_DOMAINS);
}

function isLocalFileUrl(url) {
    let parsed = parseUrl(url);
    return parsed !== null && parsed.protocol === "file:";
}

function isWebUrl(url) {
    let parsed = parseUrl(url);
    return parsed !== null && (parsed.protocol === "https:" || parsed.protocol === "http:");
}

function openExternalSafe(url) {
    if (!isWebUrl(url)) {
        console.warn(`Blocked opening external url: ${url}`);
        return false;
    }

    require("electron").shell.openExternal(url);
    return true;
}

function senderIsTrusted(event) {
    let url = event.sender.getURL();
    return isTrustedUrl(url) || isLocalFileUrl(url);
}

// Local tools (python websocket-client and similar) send no Origin or a localhost one; web pages send their own.
function isLocalWsClient(info) {
    if (!info.origin) {
        return true;
    }

    let parsed = parseUrl(info.origin);
    return parsed !== null && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
}

function globToRegExp(match) {
    let pattern = String(match)
        .replace(/[.+?^${}()|[\]\\\/]/g, "\\$&")
        .replace(/\*/g, ".*");

    return new RegExp(pattern);
}

function matchesGlob(match, url) {
    try {
        return globToRegExp(match).test(url);
    } catch (e) {
        return false;
    }
}

module.exports = {
    parseUrl,
    isTrustedUrl,
    isDarkorbitUrl,
    isLocalFileUrl,
    isWebUrl,
    openExternalSafe,
    senderIsTrusted,
    isLocalWsClient,
    globToRegExp,
    matchesGlob
};
