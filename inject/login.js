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

#autoLogin {
    background: url(https://darkorbit-22.bpsecure.com/do_img/global/companyChoose/button_sprite_238x52.png?__cv=f1bb073…) no-repeat;
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
`;

tools.addStyle(style);

document.getElementsByClassName("eh_mc_table_td")[1].insertAdjacentHTML('afterbegin', '<div align="center" style=""><input id="autoLogin" value="AUTOLOGIN" type="button"></div>');

document.getElementById("autoLogin").addEventListener("click", () => {
	ipcRenderer.send("autoLogin", true);
});

ipcRenderer.on("login", function(event, data) {
    document.getElementById("bgcdw_login_form_username").value = data[0];
    document.getElementById("bgcdw_login_form_password").value = data[1];
    document.forms["bgcdw_login_form"].submit();
});