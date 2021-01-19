const { ipcRenderer } = require("electron");
const tools = require("./tools");

let style = `
body {
    min-width: inherit !important;
}
input#rememberMe {
    display: none;
}
label#eh_mc_checkbox_text {
    display: none;
}
`;

tools.addStyle(style);

ipcRenderer.on("login", function(event, data) {
    document.getElementById("bgcdw_login_form_username").value = data[0];
    document.getElementById("bgcdw_login_form_password").value = data[1];
    document.forms["bgcdw_login_form"].submit();
});