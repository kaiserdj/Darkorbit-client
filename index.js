const Electron = require("./electron");
const Client = require("./client");

(async () => {
    let electron = await new Electron();
    let client = await new Client(electron);
})();