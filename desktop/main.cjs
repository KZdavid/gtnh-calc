const { app, BrowserWindow } = require("electron");
const path = require("path");

const APP_NAME = "GTNH Calculator";

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1200,
        minHeight: 800,
        autoHideMenuBar: true,
        title: `${APP_NAME} v${app.getVersion()}`,
        icon: path.join(app.getAppPath(), "dist", "assets", "images", "app-icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    });

    mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
}

app.whenReady().then(() => {
    app.setName(APP_NAME);
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
