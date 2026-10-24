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
`;

require("./api").injectCss(style);

// Some DarkOrbit pages match the login urls but have no login form.
let formCell = document.getElementsByClassName("eh_mc_table_td")[1];

if (formCell) {
    formCell.insertAdjacentHTML('afterbegin', '<div align="center" style=""><input id="autoLogin" value="AUTOLOGIN" type="button"></div>');
    watchLoginLayout();
}

// The cookie consent layer stops click propagation during capture, so listen before it on window.
window.addEventListener("click", (event) => {
    if (event.target && event.target.id === "autoLogin") {
        ipcRenderer.send("autoLogin");
    }
}, true);

const GAP = 12;

function visibleCaptcha() {
    let captcha = document.querySelector(".bgcdw_captcha");
    return captcha && captcha.offsetHeight > 0 && captcha.querySelector("iframe") ? captcha : null;
}

// The site places the login button, its "GİRİŞ" label and the Facebook button at fixed offsets,
// which the AUTOLOGIN button and the hCaptcha box push out of line. Re-align them below the
// captcha (or the password links) from the measured positions.
function alignLoginForm() {
    let buttons = document.querySelector(".bgcdw_login_form_buttons");
    let anchor = visibleCaptcha() || document.querySelector(".bgcdw_login_container_remindpassword") || document.getElementById("bgcdw_login_form_password");

    if (!buttons || !anchor) {
        return;
    }

    let label = document.getElementById("eh_mc_login_text");
    let facebook = document.querySelector(".bgc_fbConnect_container_link");
    let footer = document.getElementById("gl_footer");

    formCell.style.height = "";

    let shift = anchor.getBoundingClientRect().bottom + GAP - buttons.getBoundingClientRect().top;
    if (Math.abs(shift) >= 1) {
        buttons.style.setProperty("top", `${parseFloat(getComputedStyle(buttons).top) + shift}px`, "important");
    }

    let bottom = alignAroundButton(buttons, label, facebook);

    // The footer row follows the login row, whose height is fixed by the site; grow the
    // login cell (a table cell, so the row grows with it) when the footer would overlap.
    if (footer) {
        let overlap = bottom + GAP - footer.getBoundingClientRect().top;
        if (overlap > 0) {
            formCell.style.height = `${Math.ceil(formCell.getBoundingClientRect().height + overlap)}px`;
            // The cell centres its content vertically, so the label and the Facebook button moved.
            alignAroundButton(buttons, label, facebook);
        }
    }
}

// Centres the "GİRİŞ" label on the login button and puts the Facebook button below it.
// Returns the bottom of the last aligned element.
function alignAroundButton(buttons, label, facebook) {
    let button = buttons.getBoundingClientRect();
    let bottom = button.bottom;

    if (label) {
        label.style.transform = "";
        let rect = label.getBoundingClientRect();
        label.style.transform = `translateY(${(button.top + button.bottom) / 2 - (rect.top + rect.bottom) / 2}px)`;
    }

    if (facebook) {
        facebook.style.transform = "";
        facebook.style.transform = `translateY(${button.bottom + GAP - facebook.getBoundingClientRect().top}px)`;
        bottom = facebook.getBoundingClientRect().bottom;
    }

    return bottom;
}

function watchLoginLayout() {
    let scheduled = false;
    const schedule = () => {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                alignLoginForm();
            });
        }
    };

    schedule();
    window.addEventListener("load", schedule);
    window.addEventListener("resize", schedule);

    // hCaptcha is injected and resized after the page has loaded.
    let observer = new ResizeObserver(schedule);
    observer.observe(formCell);
    let captcha = document.querySelector(".bgcdw_captcha");
    if (captcha) {
        observer.observe(captcha);
    }
}

// hCaptcha fills both its own response field and a reCAPTCHA compatible one.
function captchaSolved() {
    return [...document.querySelectorAll('[name="h-captcha-response"], [name="g-recaptcha-response"]')].some(response => response.value);
}

function submitLogin() {
    let submit = document.querySelector("input.bgcdw_login_form_login[type=submit]");
    if (submit) {
        submit.click();
    }
}

let waitForCaptcha = null;

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

    clearInterval(waitForCaptcha);

    if (!visibleCaptcha() || captchaSolved()) {
        submitLogin();
        return;
    }

    // Submitting without the captcha only fails; log in as soon as the user has solved it.
    let started = Date.now();
    waitForCaptcha = setInterval(() => {
        if (captchaSolved()) {
            clearInterval(waitForCaptcha);
            submitLogin();
        } else if (Date.now() - started > 5 * 60 * 1000) {
            clearInterval(waitForCaptcha);
        }
    }, 500);
});
