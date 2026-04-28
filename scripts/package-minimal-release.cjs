const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const localizedRoot = path.join(rootDir, ".localized-build");
const releaseDir = path.join(rootDir, "release");
const packageJson = require(path.join(rootDir, "package.json"));

const bundleName = `GTNH-Calculator-${packageJson.version}-minimal-source`;
const bundleDir = path.join(releaseDir, bundleName);
const zipPath = path.join(releaseDir, `${bundleName}.zip`);

const includePaths = [
    "src",
    "assets",
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

// Prepare localized sources so minimal package ships localized src/index content.
runCommand("node", ["scripts/build-localized.cjs", "--prepare-only"]);

for (const relPath of includePaths) {
    const srcPath = resolvePackageSourcePath(relPath);
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

writeResourceConfigFiles(bundleDir);
rewriteIndexResourceConfig(path.join(bundleDir, "index.html"));
ensureDataPlaceholders(bundleDir);

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

function resolvePackageSourcePath(relPath) {
    if (relPath === "src") {
        return path.join(localizedRoot, "src");
    }
    if (relPath === "index.html") {
        return path.join(localizedRoot, "index.html");
    }
    return path.join(rootDir, relPath);
}

function removeSourceMaps(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return;
    }

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        if (entry.endsWith(".map")) {
            fs.rmSync(fullPath, { force: true });
            continue;
        }
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            removeSourceMaps(fullPath);
        }
    }
}

function removeSourceMapComments(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return;
    }

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            removeSourceMapComments(fullPath);
            continue;
        }

        if (!entry.endsWith(".js")) {
            continue;
        }

        const content = fs.readFileSync(fullPath, "utf8");
        const cleaned = content
            .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
            .replace(/^\/\/\@ sourceMappingURL=.*$/gm, "")
            .replace(/\n{3,}$/g, "\n\n");

        if (cleaned !== content) {
            fs.writeFileSync(fullPath, cleaned, "utf8");
        }
    }
}

function copyFile(src, dst) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
}

function rewriteIndexResourceConfig(indexPath) {
    if (!fs.existsSync(indexPath)) {
        return;
    }

    const html = fs.readFileSync(indexPath, "utf8");
    const inlineConfigRegex = /<script>\s*window\.GTNH_RESOURCE_CONFIG\s*=\s*\{[\s\S]*?\};\s*<\/script>/m;
    if (!inlineConfigRegex.test(html)) {
        return;
    }

    const updated = html.replace(inlineConfigRegex, "<script src=\"resource.config.js\"></script>");
    fs.writeFileSync(indexPath, updated, "utf8");
}

function writeResourceConfigFiles(outputDir) {
    const defaultConfigPath = path.join(outputDir, "resource.config.js");
    const localExamplePath = path.join(outputDir, "resource.config.local.example.js");
    const defaultConfig = [
        `window.GTNH_RESOURCE_CONFIG = {`,
        `    // Full URLs for each resource. Omit a key to use the local default path instead.`,
        `    resources: {`,
        `        "data":  "https://cdn.jsdelivr.net/gh/KZdavid/gtnh-calc-data-zh-CN@GTNH-2.8.4/data.bin",`,
        `        "atlas": "https://cdn.jsdelivr.net/gh/KZdavid/gtnh-calc-data-zh-CN@GTNH-2.8.4/atlas.webp",`,
        `    },`,
        ``,
        `    // Font switching options shown in the Settings dialog.`,
        `    // Remove this section to hide the font switcher entirely.`,
        `    fonts: {`,
        `        default: "sdk-sc-web",`,
        `        options: {`,
        `            "sdk-sc-web": {`,
        `                label: "SDK_SC_Web（默认）",`,
        `                url: "https://cdn.jsdelivr.net/gh/KZdavid/gtnh-calc@zh-CN/assets/fonts/SDK_SC_Web.ttf",`,
        `            },`,
        `            "system": { label: "系统字体", systemOnly: true },`,
        `            //          systemOnly: skip custom font, use OS system font`,
        `            // Add more fonts with a complete URL, for example:`,
        `            // "misans": { label: "MiSans", url: "https://cdn.jsdelivr.net/gh/YourRepo@tag/assets/fonts/MiSans.ttf" },`,
        `        },`,
        `    },`,
        `};`,
        ``,
    ].join("\n");
    const localExampleConfig = [
        `window.GTNH_RESOURCE_CONFIG = {`,
        `    // Local mode: omit resources to use built-in local defaults`,
        `    // (data → ./data/data.bin, atlas → ./data/atlas.webp).`,
        ``,
        `    // Font switching options shown in the Settings dialog.`,
        `    // fonts: {`,
        `    //     default: "sdk-sc-web",`,
        `    //     options: {`,
        `    //         "sdk-sc-web": { label: "SDK_SC_Web（默认）", url: "./assets/fonts/SDK_SC_Web.ttf" },`,
        `    //         "system":     { label: "系统字体", systemOnly: true },`,
        `    //     },`,
        `    // },`,
        `};`,
        ``,
    ].join("\n");
    fs.writeFileSync(defaultConfigPath, defaultConfig, "utf8");
    fs.writeFileSync(localExamplePath, localExampleConfig, "utf8");
}

function ensureDataPlaceholders(outputDir) {
    const dataDir = path.join(outputDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const readmePath = path.join(dataDir, "README.md");
    const readme = `This folder is intentionally empty in the minimal source package.\n\nTo use local data mode (resourceBaseUrl = \"\"), place these files here:\n- data.bin\n- atlas.webp\n\nRecommended source:\nhttps://github.com/KZdavid/gtnh-calc-data-zh-CN/releases\n`;
    fs.writeFileSync(readmePath, readme, "utf8");
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
