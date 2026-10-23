const { ipcRenderer } = require("electron");

const api = {
    "injectJs": async (data) => {
        let script = document.createElement('script');
        script.async = true;
        script.textContent = data;
        document.head.appendChild(script);
        return true;
    },
    "injectCss": async (data) => {
        const style = document.createElement('style');
        style.textContent = data;
        document.head.append(style);
        return true;
    },
    "getConfig": async () => {
        return ipcRenderer.invoke("getConfig").then(data => data);
    },
    "get": async (data) => {
        return ipcRenderer.invoke("get", data).then(data => data);
    },
}

module.exports = api;