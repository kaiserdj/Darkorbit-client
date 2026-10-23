const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

document.onreadystatechange = () => {
    if (document.readyState === 'interactive') {
        run();
    }
};

function run() {
    ipcRenderer.send("LoadSettings", true);

    // Settings
    document.getElementById("HardwareAcceleration").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "HardwareAcceleration", document.getElementById("HardwareAcceleration").checked);
        if(confirm("For the changes to take effect, the client must be restarted.\nDo you want to restart it now?")) {
            ipcRenderer.send("relaunch");
        }
    }

    document.getElementById("PreventCloseGame").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "PreventCloseGame", document.getElementById("PreventCloseGame").checked);
    }

    document.getElementById("PreventCloseSessionWindow").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "PreventCloseSessionWindow", document.getElementById("PreventCloseSessionWindow").checked);
    }

    document.getElementById("DefaultDev").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "DefaultDev", document.getElementById("DefaultDev").checked);
    }

    document.getElementById("BackgroundThrottling").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "BackgroundThrottling", document.getElementById("BackgroundThrottling").checked);
    }

    document.getElementById("Packet").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "Packet", document.getElementById("Packet").checked);
    }

    document.getElementById("PacketTimeout").onchange = () => {
        ipcRenderer.send("SetOptionConfig", "PacketTimeout", document.getElementById("PacketTimeout").value);
    }

    document.getElementById("PythonPath").onchange = () => {
        ipcRenderer.send("SetOptionConfig", "PythonPath", document.getElementById("PythonPath").value.trim());
    }

    // Donation
    for (let address of document.getElementsByClassName("coin-address")) {
        address.addEventListener("click", () => {
            if (address.dataset.url) {
                ipcRenderer.send("openExternal", address.dataset.url);
            } else {
                address.select();
            }
        });
    }

    // Contributors
    renderContributors();

    // About us
    document.getElementById("Github").onclick = (sub) => {
        sub.preventDefault();
        ipcRenderer.send("openExternal", "https://github.com/kaiserdj/Darkorbit-client");
    }
}

function readContributors() {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, "../.all-contributorsrc"), "utf8")).contributors || [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

function renderContributors() {
    let container = document.getElementById("contributors");

    for (let contributor of readContributors()) {
        let emotes = document.createElement("ul");
        emotes.className = "list-unstyled team-social social-icon social mb-0";

        for (let emote of contributor.contributions || []) {
            let title = String(emote).replace(/[A-Z]/g, letter => ` ${letter}`);

            let link = document.createElement("a");
            link.href = "#";
            link.className = "rounded";
            link.title = title.charAt(0).toUpperCase() + title.slice(1);
            link.textContent = emojiKey[emote] || "";

            let item = document.createElement("li");
            item.className = "list-inline-item";
            item.appendChild(link);
            emotes.appendChild(item);
        }

        let img = document.createElement("img");
        img.className = "img-fluid rounded";
        img.width = 200;
        img.height = 200;
        img.alt = String(contributor.name || "");
        if (/^https:\/\//.test(contributor.avatar_url)) {
            img.src = contributor.avatar_url;
        }

        let overlay = document.createElement("div");
        overlay.className = "overlay rounded bg-dark";

        let image = document.createElement("div");
        image.className = "image position-relative d-block overflow-hidden";
        image.append(img, overlay);

        let name = document.createElement("h4");
        name.className = "title mb-0";
        name.textContent = String(contributor.name || "");

        let content = document.createElement("div");
        content.className = "content py-2 member-position bg-white border-bottom overflow-hidden rounded d-inline-block";
        content.appendChild(name);

        let team = document.createElement("div");
        team.className = "team position-relative d-block text-center";
        team.append(image, content, emotes);

        let card = document.createElement("div");
        card.className = "mt-4 pt-2";
        card.appendChild(team);
        card.addEventListener("click", (event) => {
            event.preventDefault();
            ipcRenderer.send("openExternal", String(contributor.profile || ""));
        });

        let column = document.createElement("div");
        column.className = "col-lg-3 col-md-4 col-6 mt-4 pt-2";
        column.appendChild(card);

        container.appendChild(column);
    }
}

function load(data) {
    if (data.HardwareAcceleration) {
        document.getElementById("HardwareAcceleration").checked = data.HardwareAcceleration;
    }

    if (data.PreventCloseGame) {
        document.getElementById("PreventCloseGame").checked = data.PreventCloseGame;
    }

    if (data.PreventCloseSessionWindow) {
        document.getElementById("PreventCloseSessionWindow").checked = data.PreventCloseSessionWindow;
    }

    if (data.DefaultDev) {
        document.getElementById("DefaultDev").checked = data.DefaultDev;
    }

    if (data.BackgroundThrottling) {
        document.getElementById("BackgroundThrottling").checked = data.BackgroundThrottling;
    }

    if (data.Packet) {
        document.getElementById("Packet").checked = data.Packet;
    }

    document.getElementById("PacketTimeout").value = data.PacketTimeout;
    document.getElementById("PythonPath").value = data.PythonPath || "";
}

ipcRenderer.on("SendLoadSettings", (event, data) => {
    load(data);
});

let emojiKey = {
    "audio": "🔊",
    "a11y": "♿️",
    "bug": "🐛",
    "blog": "📝",
    "business": "💼",
    "code": "💻",
    "content": "🖋",
    "data": "🔣",
    "doc": "📖",
    "design": "🎨",
    "example": "💡",
    "eventOrganizing": "📋",
    "financial": "💵",
    "fundingFinding": "🔍",
    "ideas": "🤔",
    "infra": "🚇",
    "maintenance": "🚧",
    "mentoring": "🧑‍🏫",
    "platform": "📦",
    "plugin": "🔌",
    "projectManagement": "📆",
    "question": "💬",
    "research": "🔬",
    "review": "👀",
    "security": "🛡️",
    "tool": "🔧",
    "translation": "🌍",
    "test": "⚠️",
    "tutorial": "✅",
    "talk": "📢",
    "userTesting": "📓",
    "video": "📹"
}