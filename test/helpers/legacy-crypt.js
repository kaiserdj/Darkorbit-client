// The credential format written by client versions up to 2.8.0, used to build migration fixtures.
// AES-256-CTR with a key embedded in the client and the master hash reused as the IV.

const crypto = require("crypto");

const LEGACY_KEY = "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3";

function hash(password, salt) {
    return crypto.createHash("md5").update(password + salt).digest("hex");
}

function encrypt(text, ivHex) {
    let iv = ivHex ? Buffer.from(ivHex, "hex") : crypto.randomBytes(16);
    let cipher = crypto.createCipheriv("aes-256-ctr", LEGACY_KEY, iv);
    return {
        iv: iv.toString("hex"),
        content: Buffer.concat([cipher.update(text), cipher.final()]).toString("hex")
    };
}

// Settings fields as stored by the old client for `password` and `accounts`.
function legacySettings(password, accounts) {
    let salt = crypto.randomBytes(16).toString("hex");
    let hashMaster = hash(password, salt);
    let settings = { salt, master: encrypt(hashMaster) };

    if (accounts) {
        settings.accounts = encrypt(JSON.stringify(accounts), hashMaster).content;
    }

    return settings;
}

module.exports = {
    hash,
    encrypt,
    legacySettings
};
