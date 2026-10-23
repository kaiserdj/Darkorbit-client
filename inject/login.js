const { ipcRenderer } = require("electron");

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

require("./api").injectCss(style);

// Some DarkOrbit pages match the login urls but have no login form.
let formCell = document.getElementsByClassName("eh_mc_table_td")[1];

if (formCell) {
    formCell.insertAdjacentHTML('afterbegin', '<div align="center" style=""><input id="autoLogin" value="AUTOLOGIN" type="button"></div>');
}

// The cookie consent layer stops click propagation during capture, so listen before it on window.
window.addEventListener("click", (event) => {
    if (event.target && event.target.id === "autoLogin") {
        ipcRenderer.send("autoLogin");
    }
}, true);

ipcRenderer.on("login", (event, data) => {
    let username = document.getElementById("bgcdw_login_form_username");
    let password = document.getElementById("bgcdw_login_form_password");

    if (!username || !password) {
        return;
    }

    username.click();
    username.value = data[0];

    password.click();
    password.value = data[1];

    if (document.querySelectorAll('iframe[title="reCAPTCHA"]').length != 0) {
        alert("Por favor, complete el captcha");
    } else {
        let submit = document.querySelector("input.bgcdw_login_form_login[type=submit]");
        if (submit) {
            submit.click();
        }
    }
});
