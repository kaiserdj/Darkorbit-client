const { ipcRenderer } = require('electron');
const { dialog } = require('electron').remote;

document.onreadystatechange = () => {
    if (document.readyState === 'complete') {
        run();
    }
};

function run() {
    if (window.location.search) {
        let urlParams = new URLSearchParams(window.location.search);
        let tab = urlParams.get('tab');
        changeTab(tab)
    }

    ipcRenderer.send("LoadConfigDarkDev", true);

    /* Custom Load */
    document.getElementById("EnableCustomLoad").onclick = () => {
        ipcRenderer.send("SetEnableCustomLoad", document.getElementById("EnableCustomLoad").checked)
    }

    /* Custom Load modal */

    document.getElementById("LocalFileEnable").onclick = () => {
        if (document.getElementById("LocalFileEnable").checked) {
            document.getElementById("LocalFile").removeAttribute("disabled")
            document.getElementById("ActionUrlLoad").setAttribute("disabled", "")
            document.getElementById("ActionUrlLoad").removeAttribute("required")
            document.getElementById("LocalFile").setAttribute("required", "")
        } else {
            document.getElementById("ActionUrlLoad").removeAttribute("disabled")
            document.getElementById("LocalFile").setAttribute("disabled", "")
            document.getElementById("LocalFile").removeAttribute("required")
            document.getElementById("ActionUrlLoad").setAttribute("required", "")
        }
    }

    document.getElementById("NewCustomLoad").onsubmit = (sub) => {
        sub.preventDefault();

        let item = {};
        item.id = new Date().valueOf();
        item.enable = true;
        item.match = document.getElementById("MatchLoad").value;
        item.actionUrl = document.getElementById("ActionUrlLoad").value;
        item.LocalFileEnable = document.getElementById("LocalFileEnable").checked;
        item.LocalFile = document.querySelector("#LocalFile").files.length != 0 ? document.querySelector("#LocalFile").files[0].path : "";

        ipcRenderer.send("NewCustomLoad", item);

        window.location.search = 'tab=nav-customLoad-tab';
    }

    /* Custom Css */
    document.getElementById("EnableCustomCss").onclick = () => {
        ipcRenderer.send("SetEnableCustomCss", document.getElementById("EnableCustomCss").checked)
    }

    /* Custom Css modal */

    document.getElementById("NewCustomCss").onsubmit = (sub) => {
        sub.preventDefault();

        let item = {};
        item.id = new Date().valueOf();
        item.enable = true;
        item.match = document.getElementById("MatchCss").value;
        item.actionUrl = document.getElementById("ActionUrlCss").value;

        ipcRenderer.send("NewCustomCss", item);

        window.location.search = 'tab=nav-customCss-tab';
    }

    /* Resource Download */

    document.getElementById("CustomServer").onclick = () => {
        if (document.getElementById("CustomServer").checked) {
            document.getElementById("server").removeAttribute("disabled")
        } else {
            document.getElementById("server").setAttribute("disabled", "")
        }
    }

    document.getElementById("ResourceDownloadButton").onclick = (sub) => {
        sub.preventDefault();
        dialog.showOpenDialog({
            properties: ["openDirectory"],
            title: "Directory where you want to save the resources"
        }).then((data) => {
            if (data.filePaths[0]) {
                document.getElementById("initResourceDownload").style = "display: none";
                document.getElementById("subResourceDownload").style = "";

                let listXmlColections = [];
                let xmlColections = document.getElementById("xmlColections").getElementsByTagName("input");
                for (let elem of xmlColections) {
                    if (elem.checked) {
                        listXmlColections.push(elem.parentElement.getElementsByTagName("label")[0].textContent.trim());
                    }
                }

                let listExtraFiles = [];
                let extraFiles = document.getElementById("extraFiles").getElementsByTagName("input");
                for (let elem of extraFiles) {
                    if (elem.checked) {
                        listExtraFiles.push(elem.parentElement.getElementsByTagName("label")[0].textContent.trim());
                    }
                }

                let checkHash = document.getElementById("checkHash").checked;
                let customServer = document.getElementById("CustomServer").checked;
                let server = document.getElementById("server").value;
                let folder = data.filePaths[0];
                if (customServer) {
                    ipcRenderer.send("ResourceDownload", { listXmlColections, listExtraFiles, checkHash, customServer, server, folder });
                } else {
                    ipcRenderer.send("ResourceDownload", { listXmlColections, listExtraFiles, checkHash, customServer, folder });
                }
            }
        })
    }

    document.getElementById("SaveConsoleDownloadCButton").onclick = () => {
        let console = document.getElementById('Console').value;
        var textFileAsBlob = new Blob([console], { type: 'text/plain' });
        var fileNameToSaveAs = "Log.txt";

        var downloadLink = document.createElement("a");
        downloadLink.download = fileNameToSaveAs;
        downloadLink.innerHTML = "Download Log";
        downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);

        downloadLink.click();
    }
}

function load(data) {
    /* Custom Load */
    if (data.CustomLoad.enable) {
        document.getElementById("EnableCustomLoad").checked = data.CustomLoad.enable;
    }

    if (data.CustomLoad.list) {
        for (let id in data.CustomLoad.list) {
            let elem = data.CustomLoad.list[id];
            let table = document.getElementById('TableCustomLoad').getElementsByTagName('tbody')[0];
            let newRow = table.insertRow();
            newRow.innerHTML = `
            <tr>
                <td class="idCustomLoadItem">${elem.id}</td>
                <th scope="row">
                    <div class="form-check form-switch"><input class="form-check-input enableCustomLoadItem" type="checkbox" ${elem.enable ? "checked": ""}></div>
                </th>
                <td>${elem.match}</td>
                <td>&nbsp;<input class="form-check-input" type="checkbox" value="" id="flexCheckCheckedDisabled" ${elem.LocalFileEnable ? "checked" : ""} disabled></td>
                <td>${elem.LocalFileEnable ? elem.LocalFile : elem.actionUrl}</td>
                <td>&nbsp;
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash removeCustomLoadItem" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                    </svg>
                </td>
            </tr>`;
        }
        const enableCustomLoadItem = document.querySelectorAll('.enableCustomLoadItem');
        enableCustomLoadItem.forEach(el => el.addEventListener('click', (event) => {
            let id = event.target.parentNode.parentNode.parentNode.querySelectorAll(".idCustomLoadItem")[0].innerText;
            let enable = event.target.checked;

            ipcRenderer.send('enableCustomLoadItem', { id, enable });
        }));

        const removeCustomLoadItem = document.querySelectorAll('.removeCustomLoadItem');
        removeCustomLoadItem.forEach(el => el.addEventListener('click', (event) => {
            let elem = event.target.parentNode.parentNode;
            if (elem.tagName !== "TR") {
                elem = elem.parentNode;
            }
            ipcRenderer.send('removeCustomLoadItem', elem.querySelectorAll(".idCustomLoadItem")[0].innerText);
            
            window.location.search = 'tab=nav-customLoad-tab';
        }));
    }

    /* Custom Css */

    if (data.CustomCss.enable) {
        document.getElementById("EnableCustomCss").checked = data.CustomCss.enable;
    }

    if (data.CustomCss.list) {
        for (let id in data.CustomCss.list) {
            let elem = data.CustomCss.list[id];
            let table = document.getElementById('TableCustomCss').getElementsByTagName('tbody')[0];
            let newRow = table.insertRow();
            newRow.innerHTML = `
            <tr>
                <td class="idCustomCssItem">${elem.id}</td>
                <th scope="row">
                    <div class="form-check form-switch"><input class="form-check-input enableCustomCssItem" type="checkbox" ${elem.enable ? "checked": ""}></div>
                </th>
                <td>${elem.match}</td>
                <td>${elem.actionUrl}</td>
                <td>&nbsp;
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash removeCustomCssItem" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                    </svg>
                </td>
            </tr>`;
        }
        const enableCustomCssItem = document.querySelectorAll('.enableCustomCssItem');
        enableCustomCssItem.forEach(el => el.addEventListener('click', (event) => {
            let id = event.target.parentNode.parentNode.parentNode.querySelectorAll(".idCustomCssItem")[0].innerText;
            let enable = event.target.checked;

            ipcRenderer.send('enableCustomCssItem', { id, enable });
        }));

        const removeCustomCssItem = document.querySelectorAll('.removeCustomCssItem');
        removeCustomCssItem.forEach(el => el.addEventListener('click', (event) => {
            let elem = event.target.parentNode.parentNode;
            if (elem.tagName !== "TR") {
                elem = elem.parentNode;
            }
            ipcRenderer.send('removeCustomCssItem', elem.querySelectorAll(".idCustomCssItem")[0].innerText);

            window.location.search = 'tab=nav-customCss-tab';
        }));
    }
}

function changeTab(tab) {
    document.getElementById(tab).click();
    document.getElementById(`${tab}-mini`);
}

ipcRenderer.on("consoleDownload", (event, data) => {
    let console = document.getElementById("Console");
    console.value += data + "\n";
    console.scrollTop = console.scrollHeight;
});

ipcRenderer.on("SendLoadConfigDarkDev", (event, data) => {
    load(data)
});