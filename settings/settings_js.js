const { ipcRenderer } = require('electron');

document.onreadystatechange = () => {
    if (document.readyState === 'interactive') {
        run();
    }
};

function run() {
    ipcRenderer.send("LoadSettings", true);

    // Settings
    document.getElementById("PreventCloseGame").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "PreventCloseGame", document.getElementById("PreventCloseGame").checked)
    }

    document.getElementById("PreventCloseSessionWindow").onclick = () => {
        ipcRenderer.send("SetOptionConfig", "PreventCloseSessionWindow", document.getElementById("PreventCloseSessionWindow").checked)
    }

    // Contributors
    ipcRenderer.invoke("get", "https://raw.githubusercontent.com/kaiserdj/Darkorbit-client/main/.all-contributorsrc").then(data => {
        for (let contributor of data.contributors) {
            let elemEmote = "";
            for (let emote of contributor.contributions) {
                let title = emote;
                let upperCases = emote.match(/[A-Z]/g);

                if (upperCases) {
                    for (let letter of upperCases) {
                        title = title.replaceAll(letter, ` ${letter}`)
                    }
                }
                elemEmote += `<li class="list-inline-item"><a href="javascript:void(0)" class="rounded" title="${title.charAt(0).toUpperCase() + title.slice(1)}">${emojiKey[emote]}</a></li>`;
            }

            let elem = `
            <div class="col-lg-3 col-md-4 col-6 mt-4 pt-2">
                <div class="mt-4 pt-2" onclick='window.open(${"`"+contributor.profile+"`"})'>
                    <div class="team position-relative d-block text-center">
                        <div class="image position-relative d-block overflow-hidden">
                            <img src="${contributor.avatar_url}" class="img-fluid rounded" alt="${contributor.name}" width="200" height="200">
                            <div class="overlay rounded bg-dark"></div>
                        </div>
                        <div class="content py-2 member-position bg-white border-bottom overflow-hidden rounded d-inline-block">
                            <h4 class="title mb-0">${contributor.name}</h4>
                            <!--<small class="text-muted">Founder</small>-->
                        </div>
                        <ul class="list-unstyled team-social social-icon social mb-0">
                            ${elemEmote}
                        </ul>
                    </div>
                </div>
            </div>`;
            document.getElementById("contributors").insertAdjacentHTML("beforeend", elem);
        }
    })

    // About us
    document.getElementById("Github").onclick = (sub) => {
        sub.preventDefault();
        require('open')("https://github.com/kaiserdj/Darkorbit-client");
    }
}

function load(data) {
    if (data.PreventCloseGame) {
        document.getElementById("PreventCloseGame").checked = data.PreventCloseGame;
    }

    if (data.PreventCloseSessionWindow) {
        document.getElementById("PreventCloseSessionWindow").checked = data.PreventCloseSessionWindow;
    }
}

ipcRenderer.on("SendLoadSettings", (event, data) => {
    load(data)
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