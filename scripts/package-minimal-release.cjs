const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const releaseDir = path.join(rootDir, "release");
const packageJson = require(path.join(rootDir, "package.json"));

const bundleName = `GTNH-Calculator-${packageJson.version}-minimal-source`;
const bundleDir = path.join(releaseDir, bundleName);
const zipPath = path.join(releaseDir, `${bundleName}.zip`);

const includePaths = [
    "src",
    "assets",
    "data",
    "scripts",
    "index.html",
    "package.json",
    // package-lock.json is intentionally excluded: npm v7+ would use the lockfile to restore all
    // locked packages (including Electron), even when only specific packages are requested.
    "tsconfig.json",
    "LICENSE",
    ".gitignore",
];

const excludeRootDirs = new Set([
    "node_modules",
    "dist",
    "release",
    "export",
    ".git",
    ".github",
    "desktop",
    "tests",
]);

ensureDirectory(releaseDir);
recreateDirectory(bundleDir);

for (const relPath of includePaths) {
    const srcPath = path.join(rootDir, relPath);
    const dstPath = path.join(bundleDir, relPath);
    if (!fs.existsSync(srcPath)) {
        continue;
    }

    copyWithExcludes(srcPath, dstPath, relPath.split(path.sep)[0]);
}

const minimalDir = path.join(bundleDir, "scripts", "minimal-release");
copyFile(path.join(minimalDir, "README.md"), path.join(bundleDir, "README.md"));
copyFile(path.join(minimalDir, "install.ps1"), path.join(bundleDir, "install.ps1"));
copyFile(path.join(minimalDir, "install.sh"), path.join(bundleDir, "install.sh"));
copyFile(path.join(minimalDir, "run-local.ps1"), path.join(bundleDir, "run-local.ps1"));
copyFile(path.join(minimalDir, "run-local.sh"), path.join(bundleDir, "run-local.sh"));
copyFile(path.join(minimalDir, "clean.ps1"), path.join(bundleDir, "clean.ps1"));
copyFile(path.join(minimalDir, "clean.sh"), path.join(bundleDir, "clean.sh"));

if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
}

runCommand("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path \"${bundleDir}\" -DestinationPath \"${zipPath}\" -Force`,
]);

const stat = fs.statSync(zipPath);
const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
console.log(`Minimal source package created: ${zipPath} (${sizeMb} MB)`);

function ensureDirectory(dirPath) {
    if (fs.existsSync(dirPath) && !fs.statSync(dirPath).isDirectory()) {
        throw new Error(`Path exists and is not directory: ${dirPath}`);
    }
    fs.mkdirSync(dirPath, { recursive: true });
}

function recreateDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyWithExcludes(srcPath, dstPath, rootSegment) {
    const base = path.basename(srcPath);

    if (rootSegment === "scripts" && base === "minimal-release") {
        fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
        return;
    }

    if (rootSegment === "scripts" && (base === "dev" || base === "inspect-database.mjs")) {
        return;
    }

    if (excludeRootDirs.has(base) && srcPath === path.join(rootDir, base)) {
        return;
    }

    if (fs.statSync(srcPath).isDirectory()) {
        fs.mkdirSync(dstPath, { recursive: true });
        const entries = fs.readdirSync(srcPath);
        for (const entry of entries) {
            const childSrc = path.join(srcPath, entry);
            const childDst = path.join(dstPath, entry);
            if (entry === "node_modules" || entry === "dist" || entry === "release" || entry === "export" || entry === ".git" || (rootSegment === "scripts" && entry === "dev")) {
                continue;
            }
            copyWithExcludes(childSrc, childDst, rootSegment);
        }
        return;
    }

    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
}

function copyFile(src, dst) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
}

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        cwd: rootDir,
        stdio: "inherit",
        shell: true,
        env: {
            ...process.env,
        },
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
