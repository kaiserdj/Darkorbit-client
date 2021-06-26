const { ipcRenderer } = require("electron");

const api = {
    "inejctJs": async (data) => {
        let script = document.createElement('script');
        script.async = true;
        script.innerHTML = data;
        document.head.appendChild(script);
        return true;
    },
    "inejctCss": async (data) => {
        const style = document.createElement('style');
        style.textContent = data;
        document.head.append(style);
        return true;
    },
    "getConfig": async () => {
        return ipcRenderer.invoke("getConfig").then(data => data)
    },
    "setConfig": async (data) => {
        return ipcRenderer.invoke("setConfig", data).then(data => data)
    },
    "get": async (data) => {
        return ipcRenderer.invoke("get", data).then(data => data)
    },
    "open": async (data) => {
        return ipcRenderer.invoke("open", data).then(data => data)
    },
}

module.exports = api;