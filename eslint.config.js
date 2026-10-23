// Main process, preloads and local pages all run on Electron 11 (Node 12, V8 8.7), so the
// syntax is limited to ES2020. Tests run on the current Node version.

const shared = {
    require: "readonly",
    module: "writable",
    process: "readonly",
    __dirname: "readonly",
    Buffer: "readonly",
    console: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    setInterval: "readonly",
    clearInterval: "readonly",
    setImmediate: "readonly",
    URL: "readonly",
    URLSearchParams: "readonly",
    global: "readonly"
};

const browser = {
    window: "readonly",
    document: "readonly",
    location: "readonly",
    navigator: "readonly",
    alert: "readonly",
    confirm: "readonly",
    CustomEvent: "readonly",
    Blob: "readonly",
    DataView: "readonly",
    ArrayBuffer: "readonly",
    ResizeObserver: "readonly",
    requestAnimationFrame: "readonly",
    getComputedStyle: "readonly"
};

const rules = {
    "no-undef": "error",
    "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
    "no-unreachable": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-self-assign": "error",
    "no-case-declarations": "error",
    "no-fallthrough": "error",
    "no-redeclare": "error",
    "no-const-assign": "error",
    "no-func-assign": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "use-isnan": "error",
    "valid-typeof": "error",
    "no-constant-condition": ["error", { checkLoops: false }],
    "no-empty": ["error", { allowEmptyCatch: true }]
};

module.exports = [
    {
        ignores: ["node_modules/**", "dist/**", "flash/**", "libs/**", ".context/**"]
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "commonjs",
            globals: Object.assign({}, shared, browser)
        },
        rules
    },
    {
        files: ["test/**/*.js", "scripts/**/*.js", "eslint.config.js"],
        languageOptions: {
            ecmaVersion: 2022,
            globals: Object.assign({}, shared, { fetch: "readonly" })
        }
    }
];
