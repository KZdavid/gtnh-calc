const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = process.cwd();
const distDir = path.join(root, "dist");
const port = Number(process.env.GTNH_PORT || 5173);

if (!fs.existsSync(distDir)) {
    console.error("dist/ not found. Please run install script first.");
    process.exit(1);
}

const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === "/") pathname = "/index.html";

    const safePath = path.normalize(pathname).replace(/^([.][.][/\\])+/, "");
    let filePath = path.join(distDir, safePath);

    if (!filePath.startsWith(distDir)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 500;
            res.end("Internal Server Error");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
        res.statusCode = 200;
        res.end(data);
    });
});

server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`GTNH minimal local server running: ${url}`);
    console.log("Press Ctrl+C to stop.");
    openBrowser(url);
});

function openBrowser(url) {
    const platform = process.platform;
    if (platform === "win32") {
        spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (platform === "darwin") {
        spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
}
