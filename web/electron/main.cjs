// =============================================================================
// Electron main process.
//
// Spawns a single BrowserWindow that loads the Vite build output. Dev mode
// (npm run electron:dev) points at the running Vite server; production loads
// the packaged dist/index.html via file://. Everything else -- form, three.js
// viewer, openscad-wasm -- runs unchanged in the renderer.
// =============================================================================

const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const isDev = !!process.env.ELECTRON_DEV;

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "Roof Flange Forge",
        backgroundColor: "#1e2124",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    if (isDev) {
        win.loadURL("http://localhost:5173/");
        win.webContents.openDevTools({ mode: "detach" });
    } else {
        win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }

    // External links (README, docs) open in the user's browser, not a new
    // Electron window.
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
