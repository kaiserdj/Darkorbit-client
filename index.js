const Core = require("./core");
const Client = require("./client");

(async () => {
    let core = await new Core();
    let client = await new Client(core);
})();