const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';
let iv = crypto.randomBytes(16);

const hash = (data) => {
    return crypto.createHash('md5').update(data).digest("hex");
}

const encrypt = (data, customIv) => {
    if (customIv) {
        iv = Buffer.from(customIv, 'hex');
    }

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

const decrypt = (data) => {

    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(data.iv, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(data.content, 'hex')), decipher.final()]);

    return decrpyted.toString();
};

module.exports = {
    hash,
    encrypt,
    decrypt
};