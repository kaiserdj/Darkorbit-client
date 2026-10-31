const Core = require("./core");
const Client = require("./client");

(async () => {
    let core = await new Core();
    await new Client(core);
})();