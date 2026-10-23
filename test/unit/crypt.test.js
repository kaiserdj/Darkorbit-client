const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("path");
const legacy = require("../helpers/legacy-crypt");

const crypt = require(path.join(__dirname, "..", "..", "credentials", "crypt.js"));

describe("credentials/crypt.js", () => {
    describe("key derivation", () => {
        it("derives the same 32 byte key for the same password and salt", async () => {
            let salt = crypt.salt();
            let a = await crypt.deriveKey("hunter2", salt);
            let b = await crypt.deriveKey("hunter2", salt);
            assert.equal(a.length, 32);
            assert.deepEqual(a, b);
        });

        it("derives different keys for different salts", async () => {
            assert.notDeepEqual(await crypt.deriveKey("hunter2", crypt.salt()), await crypt.deriveKey("hunter2", crypt.salt()));
        });
    });

    describe("encryptJson / decryptJson", () => {
        it("round-trips data", async () => {
            let key = await crypt.deriveKey("pw", crypt.salt());
            let accounts = [{ id: 1, username: "pilot", password: "ş€cret" }];
            assert.deepEqual(crypt.decryptJson(key, crypt.encryptJson(key, accounts)), accounts);
        });

        it("uses a new IV for every write", async () => {
            let key = await crypt.deriveKey("pw", crypt.salt());
            let a = crypt.encryptJson(key, [1]);
            let b = crypt.encryptJson(key, [1]);
            assert.notEqual(a.iv, b.iv);
            assert.notEqual(a.data, b.data);
            assert.equal(a.v, crypt.VERSION);
        });

        it("rejects the wrong key", async () => {
            let blob = crypt.encryptJson(await crypt.deriveKey("pw", crypt.salt()), [1]);
            assert.throws(() => crypt.decryptJson(crypto.randomBytes(32), blob));
        });

        for (let field of ["data", "tag", "iv"]) {
            it(`detects a modified ${field}`, async () => {
                let key = await crypt.deriveKey("pw", crypt.salt());
                let blob = crypt.encryptJson(key, [{ password: "x" }]);
                let flipped = (blob[field][0] === "0" ? "1" : "0") + blob[field].slice(1);
                assert.throws(() => crypt.decryptJson(key, Object.assign({}, blob, { [field]: flipped })));
            });
        }

        it("rejects data in an unknown format", async () => {
            let key = await crypt.deriveKey("pw", crypt.salt());
            assert.throws(() => crypt.decryptJson(key, "deadbeef"), /Unsupported/);
            assert.throws(() => crypt.decryptJson(key, Object.assign(crypt.encryptJson(key, 1), { v: 1 })), /Unsupported/);
        });
    });

    describe("master password verifier", () => {
        it("accepts the right password and rejects others", async () => {
            let salt = crypt.salt();
            let verifier = crypt.createVerifier(await crypt.deriveKey("correct horse", salt));
            assert.equal(crypt.checkVerifier(await crypt.deriveKey("correct horse", salt), verifier), true);
            assert.equal(crypt.checkVerifier(await crypt.deriveKey("Correct horse", salt), verifier), false);
            assert.equal(crypt.checkVerifier(await crypt.deriveKey("", salt), verifier), false);
        });

        it("does not reveal the password", async () => {
            let verifier = crypt.createVerifier(await crypt.deriveKey("correct horse", crypt.salt()));
            assert.equal(JSON.stringify(verifier).includes("correct horse"), false);
        });
    });

    describe("legacy format (migration only)", () => {
        it("reads master and accounts written by version 2.8.0", () => {
            let accounts = [{ id: 42, username: "veteran", password: "old" }];
            let stored = legacy.legacySettings("oldpass", accounts);
            let hashMaster = crypt.legacyHash("oldpass", stored.salt);

            assert.equal(crypt.legacyDecrypt(stored.master), hashMaster);
            assert.deepEqual(JSON.parse(crypt.legacyDecrypt({ iv: hashMaster, content: stored.accounts })), accounts);
        });

        it("does not confirm a wrong password", () => {
            let stored = legacy.legacySettings("oldpass");
            assert.notEqual(crypt.legacyDecrypt(stored.master), crypt.legacyHash("wrong", stored.salt));
        });
    });
});
