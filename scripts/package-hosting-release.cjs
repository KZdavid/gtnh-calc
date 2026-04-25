const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const releaseDir = path.join(rootDir, "release");
const distDir = path.join(rootDir, "dist");
const packageJson = require(path.join(rootDir, "package.json"));

const bundleName = `GTNH-Calculator-${packageJson.version}-hosting`;
const bundleDir = path.join(releaseDir, bundleName);
const zipPath = path.join(releaseDir, `${bundleName}.zip`);

if (!fs.existsSync(distDir)) {
    console.error("dist/ not found. Please run build first (for example: npm run build:localized).");
    process.exit(1);
}

ensureDirectory(releaseDir);
recreateDirectory(bundleDir);

fs.cpSync(distDir, bundleDir, { recursive: true, force: true });

// Remove source maps and mapping comments to avoid release-time 404 noise.
removeSourceMaps(bundleDir);
removeSourceMapComments(bundleDir);

// Remove any local data payloads/residual test folders from dist snapshot.
const dataCandidates = ["data", "data_local_bak", "data.bak", "data_backup"];
for (const name of dataCandidates) {
    const candidatePath = path.join(bundleDir, name);
    if (fs.existsSync(candidatePath)) {
        fs.rmSync(candidatePath, { recursive: true, force: true });
    }
}

const testsDir = path.join(bundleDir, "tests");
if (fs.existsSync(testsDir)) {
    fs.rmSync(testsDir, { recursive: true, force: true });
}

// Hosting package ships no data payload by default.
const dataDir = path.join(bundleDir, "data");
fs.mkdirSync(dataDir, { recursive: true });

writeDataReadme(dataDir);
writeResourceConfigFiles(bundleDir);
rewriteIndexResourceConfig(path.join(bundleDir, "index.html"));
copyHostingReadme(bundleDir);

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
console.log(`Hosting package created: ${zipPath} (${sizeMb} MB)`);

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
    const defaultConfig = `window.GTNH_RESOURCE_CONFIG = {\n    // Set to empty string to use local files in ./data/\n    resourceBaseUrl: \"https://cdn.jsdelivr.net/gh/KZdavid/gtnh-calc-data-zh-CN@GTNH-2.8.4/\"\n};\n`;
    const localExampleConfig = `window.GTNH_RESOURCE_CONFIG = {\n    // Local mode: load ./data/data.bin and ./data/atlas.webp\n    resourceBaseUrl: \"\"\n};\n`;
    fs.writeFileSync(defaultConfigPath, defaultConfig, "utf8");
    fs.writeFileSync(localExamplePath, localExampleConfig, "utf8");
}

function writeDataReadme(outputDataDir) {
    const readmePath = path.join(outputDataDir, "README.md");
    const readme = `This folder is intentionally empty in the hosting package.\n\nTo use local data mode (resourceBaseUrl = \"\"), place these files here:\n- data.bin\n- atlas.webp\n\nRecommended source:\nhttps://github.com/KZdavid/gtnh-calc-data-zh-CN/releases\n`;
    fs.writeFileSync(readmePath, readme, "utf8");
}

function copyHostingReadme(outputDir) {
    const srcReadme = path.join(rootDir, "scripts", "minimal-release", "README-hosting.md");
    const dstReadme = path.join(outputDir, "README.md");
    if (fs.existsSync(srcReadme)) {
        fs.copyFileSync(srcReadme, dstReadme);
    }
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
