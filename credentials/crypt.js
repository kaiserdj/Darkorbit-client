const crypto = require('crypto');

const VERSION = 2;
const ALGORITHM = 'aes-256-gcm';
const VERIFIER = 'darkorbit-client-verifier';
const SCRYPT_OPTIONS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// The legacy format used a key embedded in the source code. It is only kept to migrate old settings.
const LEGACY_ALGORITHM = 'aes-256-ctr';
const LEGACY_KEY = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';

const salt = () => {
    return crypto.randomBytes(16).toString('hex');
}

const deriveKey = (password, salt) => {
    return crypto.scryptSync(String(password), Buffer.from(salt, 'hex'), 32, SCRYPT_OPTIONS);
}

const encrypt = (key, text) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);

    return {
        v: VERSION,
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        data: data.toString('hex')
    };
};

const decrypt = (key, blob) => {
    if (!blob || blob.v !== VERSION) {
        throw new Error('Unsupported encrypted data');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(blob.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(blob.tag, 'hex'));

    return Buffer.concat([decipher.update(Buffer.from(blob.data, 'hex')), decipher.final()]).toString('utf8');
};

const encryptJson = (key, value) => encrypt(key, JSON.stringify(value));

const decryptJson = (key, blob) => JSON.parse(decrypt(key, blob));

const createVerifier = (key) => encrypt(key, VERIFIER);

const checkVerifier = (key, verifier) => {
    try {
        return decrypt(key, verifier) === VERIFIER;
    } catch (e) {
        return false;
    }
};

const legacyHash = (data, salt) => {
    return crypto.createHash('md5').update(data + salt).digest("hex");
}

const legacyDecrypt = (data) => {
    const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, LEGACY_KEY, Buffer.from(data.iv, 'hex'));

    return Buffer.concat([decipher.update(Buffer.from(data.content, 'hex')), decipher.final()]).toString();
};

module.exports = {
    VERSION,
    salt,
    deriveKey,
    encrypt,
    decrypt,
    encryptJson,
    decryptJson,
    createVerifier,
    checkVerifier,
    legacyHash,
    legacyDecrypt
};
