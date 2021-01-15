const { dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const ProgressBar = require('electron-progressbar')

let updater
autoUpdater.autoDownload = false
autoUpdater.setFeedURL({
    "provider": 'github',
    "owner": "kaiserdj",
    "repo": "Darkorbit-client"
});

let progressBar

autoUpdater.on('error', (error) => {
    dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString())
})

autoUpdater.on('update-available', async (data) => {
    let check = await dialog.showMessageBoxSync({
        type: 'info',
        title: `Updates found: ${data.version}`,
        message: 'Updates found, do you want to update now?',
        detail: data.releaseNotes.replace(/<a.*>.*?<\/a>/ig,'').replace(/<p>/ig,'').replace(/<\/p>/ig,'').replace(/<br \/>/ig,''),
        buttons: ['Yes', 'No']
    })

    if (check === 0) {
        autoUpdater.downloadUpdate()

        progressBar = new ProgressBar({
            indeterminate: false,
            title: 'Update in progress',
            text: 'Preparing to download updates.',
            detail: 'Downloading ...'
        })

        progressBar.on('completed', function() {
                progressBar.detail = 'Download complete.';
            })
            .on('progress', function(value) {
                progressBar.text = 'Downloading updates.';
                progressBar.detail = `Downloading ... ${value}%`;
            })
    } else {
        updater.enabled = true
        updater = null
    }
})

autoUpdater.on('download-progress', (progressObj) => {
    progressBar.value = parseInt(progressObj.percent)
    console.log(progressObj)
})

autoUpdater.on('update-not-available', () => {
    console.log("No update")
    updater.enabled = true
    updater = null
})

autoUpdater.on('update-downloaded', async () => {
    await dialog.showMessageBoxSync({
        title: 'Install updates',
        message: 'Downloaded updates, the application will close to update ...'
    })

    autoUpdater.quitAndInstall()
})

function checkForUpdates(menuItem, focusedWindow, event) {
    updater = { enabled: false }
    updater.enabled = false
    autoUpdater.checkForUpdates()
}
module.exports.checkForUpdates = checkForUpdates