const { ipcRenderer, remote } = require("electron");
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

#autoLogin {
    background: url(https://darkorbit-22.bpsecure.com/do_img/global/companyChoose/button_sprite_238x52.png) no-repeat;
    width: 238px;
    height: 52px !important;
    color: #ffffff;
    font-family: Arial;
    font-weight: bold;
    font-size: 17px;
    border: 0px;
    text-align: center;
    cursor:pointer;
}
#autoLogin:hover {
    background-position: 0px -52px;
}

.bgc .bgcdw_login_form_buttons {
    top: 150px !important;
}
`;

tools.addStyle(style);

document.getElementsByClassName("eh_mc_table_td")[1].insertAdjacentHTML('afterbegin', '<div align="center" style=""><input id="autoLogin" value="AUTOLOGIN" type="button"></div>');

document.getElementById("autoLogin").addEventListener("click", () => {
	ipcRenderer.send("autoLogin", remote.getCurrentWindow().id);
});

ipcRenderer.on("login", (event, data) => {
    document.getElementById("bgcdw_login_form_username").click();
    document.getElementById("bgcdw_login_form_username").value = data[0];

    document.getElementById("bgcdw_login_form_password").click();
    document.getElementById("bgcdw_login_form_password").value = data[1];

    document.querySelector("input.bgcdw_login_form_login[type=submit]").click();
});