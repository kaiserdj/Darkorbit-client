const { dialog } = require('electron');

let updater = false;
let progressBar;
let autoUpdater = null;

// electron-updater is loaded on first use so it does not slow down startup.
function init() {
    if (autoUpdater) {
        return autoUpdater;
    }

    autoUpdater = require('electron-updater').autoUpdater;
    const ProgressBar = require('electron-progressbar');

    autoUpdater.autoDownload = false;
    autoUpdater.setFeedURL({
        "provider": 'github',
        "owner": "emrementese",
        "repo": "darkorbit-client-secure"
    });

    autoUpdater.on('error', (error) => {
        console.error(error);
        dialog.showErrorBox('Update error', error == null ? "unknown" : (error.message || String(error)));
    });

    autoUpdater.on('update-available', async (data) => {
        let check = await dialog.showMessageBoxSync({
            type: 'info',
            title: `Updates found: ${data.version}`,
            message: 'Updates found, do you want to update now?',
            detail: String(data.releaseNotes || "").replace(/<a.*>.*?<\/a>/ig, '').replace(/<p>/ig, '').replace(/<\/p>/ig, '').replace(/<br \/>/ig, ''),
            buttons: ['Yes', 'No']
        });

        if (check === 0) {
            updater = true;
            autoUpdater.downloadUpdate();

            progressBar = new ProgressBar({
                indeterminate: false,
                title: 'Update in progress',
                text: 'Preparing to download updates.',
                detail: 'Downloading ...'
            });

            progressBar
                .on('progress', (value) => {
                    progressBar.text = 'Downloading updates.';
                    progressBar.detail = `Downloading ... ${value}%`;
                })
                .on('completed', () => {
                    progressBar.detail = 'Download complete.';
                });
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        if (progressBar) {
            progressBar.value = parseInt(progressObj.percent);
        }
    });

    autoUpdater.on('update-not-available', () => {
        console.log("No update");
    });

    autoUpdater.on('update-downloaded', async () => {
        if (progressBar) {
            progressBar.close();
        }
        await dialog.showMessageBoxSync({
            title: 'Install updates',
            message: 'Downloaded updates, the application will close to update ...'
        });

        autoUpdater.quitAndInstall();
    });

    return autoUpdater;
}

async function checkForUpdates() {
    try {
        await init().checkForUpdates();
    } catch (error) {
        // The 'error' event already reported it.
        console.error(error);
    }

    return updater;
}

module.exports = checkForUpdates;