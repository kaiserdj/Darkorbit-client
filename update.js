const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const ProgressBar = require('electron-progressbar');

autoUpdater.autoDownload = false;
autoUpdater.setFeedURL({
    "provider": 'github',
    "owner": "kaiserdj",
    "repo": "Darkorbit-client"
});

let updater = false;
let progressBar;

autoUpdater.on('error', (error) => {
    dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString());
});

autoUpdater.on('update-available', async (data) => {
    let check = await dialog.showMessageBoxSync({
        type: 'info',
        title: `Updates found: ${data.version}`,
        message: 'Updates found, do you want to update now?',
        detail: data.releaseNotes.replace(/<a.*>.*?<\/a>/ig, '').replace(/<p>/ig, '').replace(/<\/p>/ig, '').replace(/<br \/>/ig, ''),
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
    progressBar.value = parseInt(progressObj.percent);
});

autoUpdater.on('update-not-available', () => {
    console.log("No update");
});

autoUpdater.on('update-downloaded', async () => {
    progressBar.close();
    await dialog.showMessageBoxSync({
        title: 'Install updates',
        message: 'Downloaded updates, the application will close to update ...'
    });

    autoUpdater.quitAndInstall();
});

async function checkForUpdates() {
    await autoUpdater.checkForUpdates();

    return updater;
}

module.exports = checkForUpdates;