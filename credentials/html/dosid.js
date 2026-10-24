// Sandboxed preload for dosid.html: only forwards the entered url to the main process.
const { ipcRenderer } = require('electron');

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("form").addEventListener("submit", (event) => {
        event.preventDefault();
        ipcRenderer.send("dosidSubmit", document.getElementById("url").value.trim());
    });

    document.getElementById("cancel").addEventListener("click", () => {
        ipcRenderer.send("dosidCancel");
    });
});
